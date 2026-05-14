import { NextResponse } from "next/server";
import {
  apiErrorResponse,
  consumeTrialConversation,
  requireApiGenerationUser,
} from "@/lib/api-auth";
import {
  executeParallelRun,
  executeParallelRunIncremental,
  executeSequentialRun,
  executeSequentialRunIncremental,
} from "@/lib/ai/workflow";
import { assertProvidersReadyForRun } from "@/lib/provider-availability";
import {
  recordUsageSuccess,
  requireUsageAccess,
} from "@/lib/usage-policy";
import { runWorkbenchSchema } from "@/lib/validation";
import type { ProviderName } from "@/lib/ai/types";

type StreamEmitter = (event: Record<string, unknown>) => void;

function createNdjsonStream(
  run: (emit: StreamEmitter) => Promise<void>,
) {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        const emit: StreamEmitter = (event) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };

        try {
          await run(emit);
        } catch (error) {
          emit({
            type: "error",
            error:
              error instanceof Error
                ? error.message
                : "The run failed while streaming results.",
          });
        } finally {
          controller.close();
        }
      },
    }),
    {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    },
  );
}

async function recordUsageSuccessSafely(
  input: Parameters<typeof recordUsageSuccess>[0],
) {
  try {
    return await recordUsageSuccess(input);
  } catch (error) {
    console.error("[workbench/run] usage recording failed after generation", error);
    return undefined;
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiGenerationUser();
    const wantsStream = request.headers
      .get("accept")
      ?.includes("application/x-ndjson");
    const parsed = runWorkbenchSchema.safeParse(await request.json());
    const inputCharCount =
      (parsed.success ? parsed.data.originalInput.length : 0) +
      (parsed.success ? parsed.data.additionalInstruction?.length ?? 0 : 0);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid run request." },
        { status: 400 },
      );
    }

    const usageContext = user.isTrial
      ? null
      : await requireUsageAccess({
          userId: user.id,
          inputCharCount,
        });

    if (parsed.data.mode === "parallel") {
      if (!parsed.data.targets?.length) {
        return NextResponse.json(
          { error: "Select at least one target model." },
          { status: 400 },
        );
      }
      const targets = parsed.data.targets;

      const providerError = await assertProvidersReadyForRun(
        targets.map((target) => target.provider as ProviderName),
        user.id,
      );
      if (providerError) {
        return NextResponse.json({ error: providerError }, { status: 400 });
      }

      if (user.isTrial) {
        await consumeTrialConversation(user);
      }

      if (wantsStream) {
        return createNdjsonStream(async (emit) => {
          const result = await executeParallelRunIncremental({
            userId: user.id,
            session: parsed.data,
            targets: targets.map((target) => ({
              provider: target.provider as ProviderName,
              model: target.model,
            })),
            callbacks: {
              onSession: (session) => {
                emit({ type: "session", session });
              },
              onStepStart: (event) => {
                emit({ type: "progress", status: "active", ...event });
              },
              onResult: (event) => {
                emit({
                  type: "result",
                  index: event.index,
                  result: event.result,
                });
              },
            },
          });

          const usage = user.isTrial
            ? undefined
            : await recordUsageSuccessSafely({
                userId: user.id,
                requestType: "compare",
                selectedModels: targets.map(
                  (target) => `${target.provider}/${target.model}`,
                ),
                inputCharCount,
                inputTokenCount: (result.results || []).reduce(
                  (sum, item) => sum + (item.tokenUsagePrompt ?? 0),
                  0,
                ),
                outputTokenCount: (result.results || []).reduce(
                  (sum, item) => sum + (item.tokenUsageCompletion ?? 0),
                  0,
                ),
                estimatedCostUsd: (result.results || []).reduce(
                  (sum, item) => sum + (item.estimatedCost ?? 0),
                  0,
                ),
                context: usageContext ?? undefined,
              });

          if (usage) {
            emit({ type: "usage", usage });
          }
          emit({ type: "done", ...result, usage });
        });
      }

      const result = await executeParallelRun({
        userId: user.id,
        session: parsed.data,
        targets: targets.map((target) => ({
          provider: target.provider as ProviderName,
          model: target.model,
        })),
      });

      const usage = user.isTrial
        ? undefined
        : await recordUsageSuccessSafely({
            userId: user.id,
            requestType: "compare",
            selectedModels: targets.map(
              (target) => `${target.provider}/${target.model}`,
            ),
            inputCharCount,
            inputTokenCount: (result.results || []).reduce(
              (sum, item) => sum + (item.tokenUsagePrompt ?? 0),
              0,
            ),
            outputTokenCount: (result.results || []).reduce(
              (sum, item) => sum + (item.tokenUsageCompletion ?? 0),
              0,
            ),
            estimatedCostUsd: (result.results || []).reduce(
              (sum, item) => sum + (item.estimatedCost ?? 0),
              0,
            ),
            context: usageContext ?? undefined,
          });

      return NextResponse.json({ ...result, usage });
    }

    if (!parsed.data.steps?.length) {
      return NextResponse.json(
        { error: "Add at least one workflow step." },
        { status: 400 },
      );
    }
    const steps = parsed.data.steps;

    const providerError = await assertProvidersReadyForRun(
      steps.map((step) => step.targetProvider as ProviderName),
      user.id,
    );
    if (providerError) {
      return NextResponse.json({ error: providerError }, { status: 400 });
    }

    if (user.isTrial) {
      await consumeTrialConversation(user);
    }

    if (wantsStream) {
      return createNdjsonStream(async (emit) => {
        const mappedSteps = steps.map((step) => ({
          ...step,
          targetProvider: step.targetProvider as ProviderName,
        }));
        const workflowControl = parsed.data.workflowControl
          ? {
              repeat: parsed.data.workflowControl.repeat
                ? {
                    enabled: parsed.data.workflowControl.repeat.enabled,
                    startStepOrder:
                      parsed.data.workflowControl.repeat.startStepOrder,
                    endStepOrder: parsed.data.workflowControl.repeat.endStepOrder,
                    repeatCount: parsed.data.workflowControl.repeat.repeatCount,
                  }
                : undefined,
              stopCondition: parsed.data.workflowControl.stopCondition
                ? {
                    enabled: parsed.data.workflowControl.stopCondition.enabled,
                    checkStepOrder:
                      parsed.data.workflowControl.stopCondition.checkStepOrder,
                    qualityThreshold:
                      parsed.data.workflowControl.stopCondition.qualityThreshold,
                  }
                : undefined,
            }
          : undefined;

        const result = await executeSequentialRunIncremental({
          userId: user.id,
          session: parsed.data,
          steps: mappedSteps,
          workflowControl,
          callbacks: {
            onSession: (session) => {
              emit({ type: "session", session });
            },
            onStepStart: (event) => {
              emit({ type: "progress", status: "active", ...event });
            },
            onResult: (event) => {
              emit({
                type: "result",
                index: event.index,
                result: event.result,
              });
            },
          },
        });

        const usage = user.isTrial
          ? undefined
          : await recordUsageSuccessSafely({
              userId: user.id,
              requestType: "compare",
              selectedModels: steps.map(
                (step) => `${step.targetProvider}/${step.targetModel}`,
              ),
              inputCharCount,
              inputTokenCount: (result.results || []).reduce(
                (sum, item) => sum + (item.tokenUsagePrompt ?? 0),
                0,
              ),
              outputTokenCount: (result.results || []).reduce(
                (sum, item) => sum + (item.tokenUsageCompletion ?? 0),
                0,
              ),
              estimatedCostUsd: (result.results || []).reduce(
                (sum, item) => sum + (item.estimatedCost ?? 0),
                0,
              ),
              context: usageContext ?? undefined,
            });

        if (usage) {
          emit({ type: "usage", usage });
        }
        emit({ type: "done", ...result, usage });
      });
    }

    const result = await executeSequentialRun({
      userId: user.id,
      session: parsed.data,
      steps: steps.map((step) => ({
        ...step,
        targetProvider: step.targetProvider as ProviderName,
      })),
      workflowControl: parsed.data.workflowControl
        ? {
            repeat: parsed.data.workflowControl.repeat
              ? {
                  enabled: parsed.data.workflowControl.repeat.enabled,
                  startStepOrder:
                    parsed.data.workflowControl.repeat.startStepOrder,
                  endStepOrder: parsed.data.workflowControl.repeat.endStepOrder,
                  repeatCount: parsed.data.workflowControl.repeat.repeatCount,
                }
              : undefined,
            stopCondition: parsed.data.workflowControl.stopCondition
              ? {
                  enabled: parsed.data.workflowControl.stopCondition.enabled,
                  checkStepOrder:
                    parsed.data.workflowControl.stopCondition.checkStepOrder,
                  qualityThreshold:
                    parsed.data.workflowControl.stopCondition.qualityThreshold,
                }
              : undefined,
          }
        : undefined,
    });

    const usage = user.isTrial
      ? undefined
      : await recordUsageSuccessSafely({
          userId: user.id,
          requestType: "compare",
          selectedModels: steps.map(
            (step) => `${step.targetProvider}/${step.targetModel}`,
          ),
          inputCharCount,
          inputTokenCount: (result.results || []).reduce(
            (sum, item) => sum + (item.tokenUsagePrompt ?? 0),
            0,
          ),
          outputTokenCount: (result.results || []).reduce(
            (sum, item) => sum + (item.tokenUsageCompletion ?? 0),
            0,
          ),
          estimatedCostUsd: (result.results || []).reduce(
            (sum, item) => sum + (item.estimatedCost ?? 0),
            0,
          ),
          context: usageContext ?? undefined,
        });

    return NextResponse.json({ ...result, usage });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
