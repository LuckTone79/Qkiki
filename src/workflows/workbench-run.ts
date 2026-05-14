import { getWritable } from "workflow";
import type { ProviderName } from "@/lib/ai/types";
import {
  executeParallelRunIncremental,
  executeSequentialRunIncremental,
  pickFinalResultId,
} from "@/lib/ai/workflow";
import {
  recordUsageSuccess,
  type UsageStatusSummary,
} from "@/lib/usage-policy";
import type { RunWorkbenchInput } from "@/lib/validation";
import {
  deserializeUsageCheckContext,
  type SerializedUsageCheckContext,
} from "@/lib/execution-runs";

type WorkbenchStreamSession = {
  id: string;
  title: string;
  finalResultId?: string | null;
};

type WorkbenchRunStreamEvent =
  | {
      type: "session";
      session: WorkbenchStreamSession;
    }
  | {
      type: "progress";
      index: number;
      title?: string;
      subtitle?: string;
      status?: "queued" | "active" | "completed" | "failed" | "skipped";
      detail?: string;
    }
  | {
      type: "result";
      index: number;
      result: Awaited<
        ReturnType<typeof executeParallelRunIncremental>
      >["results"][number];
    }
  | {
      type: "usage";
      usage: UsageStatusSummary;
    }
  | {
      type: "done";
      session?: WorkbenchStreamSession;
      results?: Awaited<
        ReturnType<typeof executeParallelRunIncremental>
      >["results"];
      streamError?: string;
      executionSummary?: {
        plannedTotal: number;
        executedTotal: number;
        stoppedEarly: boolean;
        stopReason?: string | null;
      };
      usage?: UsageStatusSummary;
    }
  | {
      type: "error";
      error?: string;
      code?: string;
      redirectUrl?: string;
      usage?: UsageStatusSummary;
    };

export type WorkbenchRunWorkflowPayload = {
  userId: string;
  inputCharCount: number;
  requestType: "compare" | "sequential";
  session: RunWorkbenchInput;
  usageContext?: SerializedUsageCheckContext | null;
};

type WorkbenchRunWorkflowResult = Extract<
  WorkbenchRunStreamEvent,
  { type: "done" }
>;

function toSessionSnapshot(input: {
  id: string;
  title: string;
  finalResultId?: string | null;
}): WorkbenchStreamSession {
  return {
    id: input.id,
    title: input.title,
    finalResultId: input.finalResultId ?? null,
  };
}

async function executeWorkbenchRunStep(
  payload: WorkbenchRunWorkflowPayload,
): Promise<WorkbenchRunWorkflowResult> {
  "use step";

  const writable = getWritable<WorkbenchRunStreamEvent>();
  const writer = writable.getWriter();
  const emit = async (event: WorkbenchRunStreamEvent) => {
    await writer.write(event);
  };

  let latestSession: WorkbenchStreamSession | null = null;

  try {
    const callbacks = {
      onSession: async (session: {
        id: string;
        title: string;
        finalResultId?: string | null;
      }) => {
        latestSession = toSessionSnapshot(session);
        await emit({
          type: "session",
          session: latestSession,
        });
      },
      onStepStart: async (event: {
        index: number;
        title: string;
        subtitle: string;
        detail?: string;
      }) => {
        await emit({
          type: "progress",
          index: event.index,
          title: event.title,
          subtitle: event.subtitle,
          status: "active",
          detail: event.detail,
        });
      },
      onResult: async (event: {
        index: number;
        result: Awaited<
          ReturnType<typeof executeParallelRunIncremental>
        >["results"][number];
      }) => {
        await emit({
          type: "result",
          index: event.index,
          result: event.result,
        });
      },
    };

    let result: Awaited<ReturnType<typeof executeParallelRunIncremental>>;
    let executionSummary:
      | {
          plannedTotal: number;
          executedTotal: number;
          stoppedEarly: boolean;
          stopReason?: string | null;
        }
      | undefined;

    if (payload.session.mode === "parallel") {
      result = await executeParallelRunIncremental({
        userId: payload.userId,
        session: payload.session,
        targets: (payload.session.targets ?? []).map((target) => ({
          provider: target.provider as ProviderName,
          model: target.model,
        })),
        callbacks,
      });
    } else {
      const sequentialResult = await executeSequentialRunIncremental({
        userId: payload.userId,
        session: payload.session,
        steps: (payload.session.steps ?? []).map((step) => ({
          ...step,
          targetProvider: step.targetProvider as ProviderName,
        })),
        workflowControl: payload.session.workflowControl
          ? {
              repeat: payload.session.workflowControl.repeat
                ? {
                    enabled: payload.session.workflowControl.repeat.enabled,
                    startStepOrder:
                      payload.session.workflowControl.repeat.startStepOrder,
                    endStepOrder:
                      payload.session.workflowControl.repeat.endStepOrder,
                    repeatCount:
                      payload.session.workflowControl.repeat.repeatCount,
                  }
                : undefined,
              stopCondition: payload.session.workflowControl.stopCondition
                ? {
                    enabled:
                      payload.session.workflowControl.stopCondition.enabled,
                    checkStepOrder:
                      payload.session.workflowControl.stopCondition
                        .checkStepOrder,
                    qualityThreshold:
                      payload.session.workflowControl.stopCondition
                        .qualityThreshold,
                  }
                : undefined,
            }
          : undefined,
        callbacks,
      });

      result = sequentialResult;
      executionSummary = sequentialResult.executionSummary;
    }

    latestSession = toSessionSnapshot(result.session);

    const usage = payload.usageContext
      ? await recordUsageSuccess({
          userId: payload.userId,
          requestType: payload.requestType,
          selectedModels:
            payload.session.mode === "parallel"
              ? (payload.session.targets ?? []).map(
                  (target) => `${target.provider}/${target.model}`,
                )
              : (payload.session.steps ?? []).map(
                  (step) => `${step.targetProvider}/${step.targetModel}`,
                ),
          inputCharCount: payload.inputCharCount,
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
          context: deserializeUsageCheckContext(payload.usageContext),
        })
      : undefined;

    if (usage) {
      await emit({ type: "usage", usage });
    }

    const hasFailedResults = result.results.some(
      (item) => item.status === "failed",
    );
    const finalResultId =
      result.session.finalResultId ?? pickFinalResultId(result.results);
    const streamError = hasFailedResults
      ? "One or more model runs ended with an error."
      : "";
    const doneEvent: WorkbenchRunWorkflowResult = {
      type: "done",
      session: {
        ...latestSession,
        finalResultId,
      },
      results: result.results,
      streamError: streamError || undefined,
      executionSummary,
      usage,
    };

    await emit(doneEvent);
    return doneEvent;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The durable AI run failed.";

    await emit({
      type: "error",
      error: message,
    });
    throw error;
  } finally {
    writer.releaseLock();
  }
}

export async function workbenchRunWorkflow(
  payload: WorkbenchRunWorkflowPayload,
): Promise<WorkbenchRunWorkflowResult> {
  "use workflow";

  return executeWorkbenchRunStep(payload);
}
