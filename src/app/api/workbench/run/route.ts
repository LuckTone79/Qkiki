import { NextResponse } from "next/server";
import {
  apiErrorResponse,
  consumeTrialConversation,
  requireApiGenerationUser,
} from "@/lib/api-auth";
import {
  executeParallelRun,
  executeSequentialRun,
} from "@/lib/ai/workflow";
import { assertProvidersReadyForRun } from "@/lib/provider-availability";
import {
  recordUsageSuccess,
  requireUsageAccess,
} from "@/lib/usage-policy";
import { runWorkbenchSchema } from "@/lib/validation";
import type { ProviderName } from "@/lib/ai/types";

export async function POST(request: Request) {
  try {
    const user = await requireApiGenerationUser();
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

      const providerError = await assertProvidersReadyForRun(
        parsed.data.targets.map((target) => target.provider as ProviderName),
        user.id,
      );
      if (providerError) {
        return NextResponse.json({ error: providerError }, { status: 400 });
      }

      if (user.isTrial) {
        await consumeTrialConversation(user);
      }

      const result = await executeParallelRun({
        userId: user.id,
        session: parsed.data,
        targets: parsed.data.targets.map((target) => ({
          provider: target.provider as ProviderName,
          model: target.model,
        })),
      });

      const usage = user.isTrial
        ? undefined
        : await recordUsageSuccess({
            userId: user.id,
            requestType: "compare",
            selectedModels: parsed.data.targets.map(
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

    const providerError = await assertProvidersReadyForRun(
      parsed.data.steps.map((step) => step.targetProvider as ProviderName),
      user.id,
    );
    if (providerError) {
      return NextResponse.json({ error: providerError }, { status: 400 });
    }

    if (user.isTrial) {
      await consumeTrialConversation(user);
    }

    const result = await executeSequentialRun({
      userId: user.id,
      session: parsed.data,
      steps: parsed.data.steps.map((step) => ({
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
      : await recordUsageSuccess({
          userId: user.id,
          requestType: "compare",
          selectedModels: parsed.data.steps.map(
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
