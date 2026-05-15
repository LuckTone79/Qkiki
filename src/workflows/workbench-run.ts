import { getWritable } from "workflow";
import type { ActionType, ProviderName } from "@/lib/ai/types";
import {
  executeParallelRunIncremental,
  executeSequentialRunIncremental,
  pickFinalResultId,
} from "@/lib/ai/workflow";
import {
  completeExecutionRun,
  failExecutionRun,
  isExecutionRunCanceled,
  markExecutionRunRunning,
  updateExecutionRunProgress,
  updateExecutionRunSession,
} from "@/lib/execution-runs";
import {
  recordUsageSuccess,
  releaseUsageReservation,
  settleUsageReservation,
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
      actionType?: ActionType;
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
  executionRunId?: string;
  usageReservationId?: string | null;
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

function getSelectedModels(session: RunWorkbenchInput) {
  return session.mode === "parallel"
    ? (session.targets ?? []).map(
        (target) => `${target.provider}/${target.model}`,
      )
    : (session.steps ?? []).map(
        (step) => `${step.targetProvider}/${step.targetModel}`,
      );
}

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
  let resultsCompleted = 0;
  const completedResults: Awaited<
    ReturnType<typeof executeParallelRunIncremental>
  >["results"] = [];

  try {
    if (payload.executionRunId) {
      await markExecutionRunRunning(payload.executionRunId);
    }

    const callbacks = {
      onSession: async (session: {
        id: string;
        title: string;
        finalResultId?: string | null;
      }) => {
        latestSession = toSessionSnapshot(session);
        if (payload.executionRunId) {
          await updateExecutionRunSession({
            executionRunId: payload.executionRunId,
            sessionId: session.id,
            finalResultId: session.finalResultId ?? null,
          });
        }
        await emit({
          type: "session",
          session: latestSession,
        });
      },
      onStepStart: async (event: {
        index: number;
        title: string;
        subtitle: string;
        actionType?: ActionType;
        detail?: string;
      }) => {
        await emit({
          type: "progress",
          index: event.index,
          title: event.title,
          subtitle: event.subtitle,
          actionType: event.actionType,
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
        resultsCompleted += 1;
        completedResults.push(event.result);
        if (payload.executionRunId) {
          await updateExecutionRunProgress({
            executionRunId: payload.executionRunId,
            totalStepsDone: resultsCompleted,
          });
        }
        await emit({
          type: "result",
          index: event.index,
          result: event.result,
        });
      },
      shouldStop: async () =>
        payload.executionRunId
          ? isExecutionRunCanceled(payload.executionRunId)
          : false,
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
              repeatBlocks: payload.session.workflowControl.repeatBlocks
                ? payload.session.workflowControl.repeatBlocks.map((block) => ({
                    startStepOrder: block.startStepOrder,
                    endStepOrder: block.endStepOrder,
                    repeatCount: block.repeatCount,
                  }))
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

    const selectedModels = getSelectedModels(payload.session);
    const inputTokenCount = (result.results || []).reduce(
      (sum, item) => sum + (item.tokenUsagePrompt ?? 0),
      0,
    );
    const outputTokenCount = (result.results || []).reduce(
      (sum, item) => sum + (item.tokenUsageCompletion ?? 0),
      0,
    );
    const estimatedCostUsd = (result.results || []).reduce(
      (sum, item) => sum + (item.estimatedCost ?? 0),
      0,
    );
    const usage = payload.usageReservationId
      ? await settleUsageReservation({
          reservationId: payload.usageReservationId,
          userId: payload.userId,
          requestType: payload.requestType,
          selectedModels,
          inputCharCount: payload.inputCharCount,
          inputTokenCount,
          outputTokenCount,
          estimatedCostUsd,
        })
      : payload.usageContext
        ? await recordUsageSuccess({
            userId: payload.userId,
            requestType: payload.requestType,
            selectedModels,
            inputCharCount: payload.inputCharCount,
            inputTokenCount,
            outputTokenCount,
            estimatedCostUsd,
            context: deserializeUsageCheckContext(payload.usageContext),
          })
        : undefined;

    if (usage) {
      await emit({ type: "usage", usage });
    }

    const wasCanceled = executionSummary?.stopReason === "canceled";
    const hasFailedResults = result.results.some(
      (item) => item.status === "failed",
    );
    const finalResultId =
      result.session.finalResultId ?? pickFinalResultId(result.results);
    const streamError = wasCanceled
      ? "The run was stopped by the user."
      : hasFailedResults
      ? "One or more model runs ended with an error."
      : "";

    if (payload.executionRunId) {
      await completeExecutionRun({
        executionRunId: payload.executionRunId,
        status: wasCanceled ? "canceled" : streamError ? "partial" : "completed",
        sessionId: result.session.id,
        finalResultId,
        streamError: streamError || null,
        executionSummary: executionSummary ?? null,
      });
    }

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

    if (payload.usageReservationId) {
      if (resultsCompleted === 0) {
        await releaseUsageReservation({
          reservationId: payload.usageReservationId,
          userId: payload.userId,
        }).catch(() => undefined);
      } else {
        await settleUsageReservation({
          reservationId: payload.usageReservationId,
          userId: payload.userId,
          requestType: payload.requestType,
          selectedModels: getSelectedModels(payload.session),
          inputCharCount: payload.inputCharCount,
          inputTokenCount: completedResults.reduce(
            (sum, item) => sum + (item.tokenUsagePrompt ?? 0),
            0,
          ),
          outputTokenCount: completedResults.reduce(
            (sum, item) => sum + (item.tokenUsageCompletion ?? 0),
            0,
          ),
          estimatedCostUsd: completedResults.reduce(
            (sum, item) => sum + (item.estimatedCost ?? 0),
            0,
          ),
        }).catch(() => undefined);
      }
    }

    if (payload.executionRunId) {
      await failExecutionRun({
        executionRunId: payload.executionRunId,
        errorMessage: message,
      }).catch(() => undefined);
    }

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
