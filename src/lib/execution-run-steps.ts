import "server-only";

import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { getAllSessionRuntimeAttachments, type RuntimeAttachment } from "@/lib/attachments";
import { composePrompt, getSourceHeading } from "@/lib/ai/prompt";
import { textOutputForPrompt } from "@/lib/ai/image-output";
import {
  buildV2SourcePromptBlocks,
  resolveSourceContext,
  type ResolvedSourceContext,
} from "@/lib/ai/source-context";
import { callProvider } from "@/lib/ai/providers";
import { shouldEnableProviderWebSearch } from "@/lib/ai/provider-web-search";
import { normalizeRepeatBlocks, MAX_REPEAT_BLOCKS, MAX_TOTAL_SEQUENTIAL_STEPS } from "@/lib/ai/workflow-control";
import { AI_ERROR_CODES, AI_ERROR_POLICY, computeRetryDelayMs, normalizeAiError } from "@/lib/ai/error-policy";
import { fitPromptBlocksToBudget, limitAllResultsTexts, previewText } from "@/lib/ai/token-budget";
import type { ProviderName, WorkflowControlInput, WorkflowStepInput } from "@/lib/ai/types";
import { buildProjectPromptContext } from "@/lib/ai/workflow";
import { prisma } from "@/lib/prisma";
import {
  enqueueExecutionRunStep,
  getQstashRateLimitResetAt,
  isQstashDailyRateLimitError,
} from "@/lib/qstash";
import { canInlineContinue, estimateStepDurationMs } from "@/lib/workbench-step-estimator";
import { releaseUsageReservation, settleUsageReservation } from "@/lib/usage-policy";

const FUNCTION_MAX_MS = Number(process.env.WORKBENCH_FUNCTION_MAX_MS || 50_000);
const SAFETY_MARGIN_MS = 15_000;
const STEP_LOCK_TTL_MS = 5 * 60 * 1000;
const QUEUED_HANDOFF_STALE_MS = Number(
  process.env.WORKBENCH_QUEUED_HANDOFF_STALE_MS || 60_000,
);

type PlanStep = {
  orderIndex: number;
  templateStepIndex: number;
  templateStepId: string | null;
  actionType: string;
  targetProvider: string;
  targetModel: string;
  sourceMode: string;
  sourceResultId: string | null;
  instructionTemplate: string | null;
  repeatBlockIndex: number | null;
  repeatIteration: number | null;
  repeatRangeStart: number | null;
  repeatRangeEnd: number | null;
};

type ExecutionStepRecord = Prisma.ExecutionRunStepGetPayload<{
  include: {
    executionRun: {
      include: {
        session: true;
      };
    };
    result: true;
  };
}>;

type StepStatus =
  | "queued"
  | "running"
  | "retrying"
  | "completed"
  | "failed"
  | "skipped"
  | "canceled";

type StepAbortReason =
  | "user_canceled"
  | "run_canceled"
  | "ownership_lost"
  | "step_not_running"
  | "unknown";

type StepAbortMonitor = {
  signal: AbortSignal;
  stop: () => void;
  getReason: () => StepAbortReason | null;
};

function buildStepKey(executionRunId: string, orderIndex: number) {
  return `yapp:run:${executionRunId}:step:${orderIndex}`;
}

function buildAttemptKey(executionRunId: string, orderIndex: number, attemptCount: number) {
  return `yapp:run:${executionRunId}:step:${orderIndex}:attempt:${attemptCount}`;
}

function now() {
  return new Date();
}

function hashPrompt(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function isTerminalStepStatus(status: string) {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "skipped" ||
    status === "canceled"
  );
}

function promptSourcePriority(sourceMode: string) {
  if (sourceMode === "previous") {
    return "highest" as const;
  }
  if (sourceMode === "selected_result") {
    return "medium" as const;
  }
  if (sourceMode === "all_results") {
    return "low" as const;
  }
  return "highest" as const;
}

function buildAttachmentContext(attachments: RuntimeAttachment[]) {
  const textAttachments = attachments
    .filter((attachment) => attachment.extractedText?.trim())
    .map((attachment, index) =>
      [
        `[Attachment ${index + 1}] ${attachment.name}`,
        `Type: ${attachment.mimeType}`,
        attachment.extractedText?.trim() ?? "",
      ].join("\n"),
    );

  return textAttachments.join("\n\n");
}

function attachmentsForProvider(attachments: RuntimeAttachment[]) {
  return attachments.map((attachment) => ({
    ...attachment,
    extractedText: attachment.kind === "IMAGE" ? attachment.extractedText : null,
  }));
}

function assertValidSequentialPlan(steps: WorkflowStepInput[], workflowControl?: WorkflowControlInput) {
  if (!steps.length) {
    throw new Error("At least one sequential step is required.");
  }

  const repeatBlocks = normalizeRepeatBlocks(workflowControl);
  if (repeatBlocks.length > MAX_REPEAT_BLOCKS) {
    throw new Error(`You can configure up to ${MAX_REPEAT_BLOCKS} repeat blocks.`);
  }

  const sortedBlocks = [...repeatBlocks].sort((a, b) =>
    a.startStepOrder === b.startStepOrder
      ? a.endStepOrder - b.endStepOrder
      : a.startStepOrder - b.startStepOrder,
  );

  let previousEnd = 0;
  for (const block of sortedBlocks) {
    if (block.startStepOrder < 1 || block.endStepOrder > steps.length) {
      throw new Error("Repeat range is out of step bounds.");
    }
    if (block.startStepOrder > block.endStepOrder) {
      throw new Error("Repeat start step must be before or equal to end step.");
    }
    if (block.repeatCount < 1) {
      throw new Error("Repeat count must be at least 1.");
    }
    if (block.startStepOrder <= previousEnd) {
      throw new Error("Overlapping or nested repeat blocks are not supported.");
    }
    previousEnd = block.endStepOrder;
  }

  for (const step of steps) {
    if (!step.targetProvider || !step.targetModel) {
      throw new Error("Every sequential step must select a provider and model.");
    }
    if (step.sourceMode === "selected_result" && !step.sourceResultId) {
      throw new Error("selected_result steps require a fixed source result.");
    }
  }
}

export function buildExecutionRunStepPlan(input: {
  executionRunId: string;
  sessionId: string;
  templateSteps: WorkflowStepInput[];
  workflowControl?: WorkflowControlInput;
  templateStepIdsByIndex?: Map<number, string>;
  preserveTemplateOrderIndexes?: boolean;
}) {
  assertValidSequentialPlan(input.templateSteps, input.workflowControl);
  const repeatBlocks = normalizeRepeatBlocks(input.workflowControl);
  const sortedBlocks = [...repeatBlocks].sort((a, b) =>
    a.startStepOrder === b.startStepOrder
      ? a.endStepOrder - b.endStepOrder
      : a.startStepOrder - b.startStepOrder,
  );

  const steps: PlanStep[] = [];
  let nextOrderIndex = 1;
  let cursor = 1;

  const pushTemplateStep = (templateStepIndex: number, meta?: Partial<PlanStep>) => {
    const templateStep = input.templateSteps[templateStepIndex - 1];
    const orderIndex = input.preserveTemplateOrderIndexes
      ? templateStepIndex + steps.filter((step) => step.orderIndex >= templateStepIndex).length
      : nextOrderIndex++;

    steps.push({
      orderIndex,
      templateStepIndex,
      templateStepId: input.templateStepIdsByIndex?.get(templateStepIndex) ?? null,
      actionType: templateStep.actionType,
      targetProvider: templateStep.targetProvider,
      targetModel: templateStep.targetModel,
      sourceMode: templateStep.sourceMode,
      sourceResultId: templateStep.sourceResultId ?? null,
      instructionTemplate: templateStep.instructionTemplate ?? null,
      repeatBlockIndex: meta?.repeatBlockIndex ?? null,
      repeatIteration: meta?.repeatIteration ?? null,
      repeatRangeStart: meta?.repeatRangeStart ?? null,
      repeatRangeEnd: meta?.repeatRangeEnd ?? null,
    });
  };

  sortedBlocks.forEach((block, blockIndex) => {
    while (cursor < block.startStepOrder) {
      pushTemplateStep(cursor);
      cursor += 1;
    }

    for (let iteration = 1; iteration <= block.repeatCount; iteration += 1) {
      for (let templateStepIndex = block.startStepOrder; templateStepIndex <= block.endStepOrder; templateStepIndex += 1) {
        pushTemplateStep(templateStepIndex, {
          repeatBlockIndex: blockIndex + 1,
          repeatIteration: iteration,
          repeatRangeStart: block.startStepOrder,
          repeatRangeEnd: block.endStepOrder,
        });
      }
    }

    cursor = block.endStepOrder + 1;
  });

  while (cursor <= input.templateSteps.length) {
    pushTemplateStep(cursor);
    cursor += 1;
  }

  if (steps.length > MAX_TOTAL_SEQUENTIAL_STEPS) {
    throw new Error(`Total sequential executions cannot exceed ${MAX_TOTAL_SEQUENTIAL_STEPS}.`);
  }

  return steps.map((step) => ({
    ...step,
    sessionId: input.sessionId,
    executionRunId: input.executionRunId,
    stepKey: buildStepKey(input.executionRunId, step.orderIndex),
    status: "queued" as const,
    attemptCount: 0,
    maxAttempts: AI_ERROR_POLICY.PROVIDER_TIMEOUT.maxAttempts,
    queuedAt: now(),
  }));
}

export async function claimExecutionRunStep(stepId: string, workerId: string) {
  const currentNow = now();
  const lockExpiresAt = new Date(currentNow.getTime() + STEP_LOCK_TTL_MS);

  const claimed = await prisma.$queryRaw<Array<ExecutionStepRecord>>`
    UPDATE "ExecutionRunStep"
    SET
      "status" = 'running',
      "lockedBy" = ${workerId},
      "lockExpiresAt" = ${lockExpiresAt},
      "heartbeatAt" = ${currentNow},
      "startedAt" = COALESCE("startedAt", ${currentNow}),
      "attemptCount" = "attemptCount" + 1,
      "attemptKey" = CONCAT('yapp:run:', "executionRunId", ':step:', "orderIndex", ':attempt:', ("attemptCount" + 1)),
      "updatedAt" = ${currentNow}
    WHERE "id" = ${stepId}
      AND "status" IN ('queued', 'retrying')
      AND ("lockedBy" IS NULL OR "lockExpiresAt" < ${currentNow})
      AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= ${currentNow})
    RETURNING *;
  `;

  if (!claimed[0]) {
    return null;
  }

  return prisma.executionRunStep.findUnique({
    where: { id: claimed[0].id },
    include: {
      executionRun: {
        include: {
          session: true,
        },
      },
      result: true,
    },
  });
}

async function updateHeartbeat(stepId: string, workerId: string) {
  await prisma.executionRunStep.updateMany({
    where: {
      id: stepId,
      lockedBy: workerId,
      status: "running",
    },
    data: {
      heartbeatAt: now(),
      lockExpiresAt: new Date(Date.now() + STEP_LOCK_TTL_MS),
    },
  });
}

async function findParentFallbackCompletedStep(input: {
  parentExecutionRunId?: string | null;
  beforeOrderIndex?: number | null;
}) {
  if (!input.parentExecutionRunId) {
    return null;
  }

  return prisma.executionRunStep.findFirst({
    where: {
      executionRunId: input.parentExecutionRunId,
      status: "completed",
      ...(input.beforeOrderIndex ? { orderIndex: { lt: input.beforeOrderIndex } } : {}),
      result: {
        outputText: { not: null },
      },
    },
    include: {
      result: true,
    },
    orderBy: {
      orderIndex: "desc",
    },
  });
}

async function findParentCompletedSteps(input: {
  parentExecutionRunId?: string | null;
  beforeOrderIndex?: number | null;
}) {
  if (!input.parentExecutionRunId) {
    return [];
  }

  return prisma.executionRunStep.findMany({
    where: {
      executionRunId: input.parentExecutionRunId,
      status: "completed",
      ...(input.beforeOrderIndex ? { orderIndex: { lt: input.beforeOrderIndex } } : {}),
      result: {
        outputText: { not: null },
      },
    },
    include: {
      result: true,
    },
    orderBy: {
      orderIndex: "asc",
    },
  });
}

async function resolveStepSource(step: ExecutionStepRecord): Promise<ResolvedSourceContext> {
  const session = step.executionRun.session;
  const parentBeforeOrderIndex = step.executionRun.branchFromOrderIndex ?? null;

  if (step.sourceMode === "original") {
    return resolveSourceContext({
      sourceMode: "original",
      originalText: session?.originalInput ?? "",
    });
  }

  if (step.sourceMode === "selected_result") {
    if (!step.sourceResultId) {
      throw new Error("selected_result steps require a fixed source result.");
    }

    const selected = await prisma.result.findFirst({
      where: {
        id: step.sourceResultId,
        sessionId: step.sessionId,
        status: "completed",
        outputText: { not: null },
      },
      select: {
        outputText: true,
      },
    });
    const priorText = textOutputForPrompt(selected?.outputText);
    if (!priorText?.trim()) {
      throw new Error(
        "selected_result requires a completed owned result with non-empty output.",
      );
    }

    return resolveSourceContext({
      sourceMode: "selected_result",
      priorText,
    });
  }

  if (step.sourceMode === "all_results") {
    const completed = await prisma.executionRunStep.findMany({
      where: {
        executionRunId: step.executionRunId,
        orderIndex: { lt: step.orderIndex },
        status: "completed",
        result: {
          outputText: { not: null },
        },
      },
      include: {
        result: true,
      },
      orderBy: {
        orderIndex: "asc",
      },
    });

    const parentCompleted = await findParentCompletedSteps({
      parentExecutionRunId: step.executionRun.parentExecutionRunId,
      beforeOrderIndex: parentBeforeOrderIndex,
    });

    let sourceTexts = limitAllResultsTexts([
      ...parentCompleted
        .map((item) => item.result?.outputText?.trim() ?? "")
        .filter(Boolean),
      ...completed
        .map((item) => item.result?.outputText?.trim() ?? "")
        .filter(Boolean),
    ]);

    if (!sourceTexts.length) {
      const parentFallback = await findParentFallbackCompletedStep({
        parentExecutionRunId: step.executionRun.parentExecutionRunId,
        beforeOrderIndex: parentBeforeOrderIndex,
      });
      if (parentFallback?.result?.outputText?.trim()) {
        sourceTexts = [parentFallback.result.outputText.trim()];
      }
    }

    return resolveSourceContext({
      sourceMode: "all_results",
      allResultsTexts: sourceTexts.map((text, index) =>
        `Completed result ${index + 1}:\n${text}`,
      ),
      fallbackText: session?.originalInput ?? "",
      originalText: session?.originalInput ?? "",
      includeSourceSegments: true,
    });
  }

  const previousCompleted = await prisma.executionRunStep.findFirst({
    where: {
      executionRunId: step.executionRunId,
      orderIndex: { lt: step.orderIndex },
      status: "completed",
      result: {
        outputText: { not: null },
      },
    },
    include: {
      result: true,
    },
    orderBy: {
      orderIndex: "desc",
    },
  });

  const parentFallback = await findParentFallbackCompletedStep({
    parentExecutionRunId: step.executionRun.parentExecutionRunId,
    beforeOrderIndex: parentBeforeOrderIndex,
  });

  return resolveSourceContext({
    sourceMode: "previous",
    priorText:
      previousCompleted?.result?.outputText?.trim() ||
      parentFallback?.result?.outputText?.trim() ||
      "",
    fallbackText: session?.originalInput ?? "",
    originalText: session?.originalInput ?? "",
  });
}

function buildSourcePromptBlocks(input: {
  actionType: WorkflowStepInput["actionType"];
  sourceMode: string;
  sourceContext: ResolvedSourceContext;
}) {
  const { actionType, sourceMode, sourceContext } = input;
  const isScenarioOrDeepDive =
    actionType === "scenario_develop" || actionType === "deep_dive";

  if (!sourceContext.text.trim() || sourceContext.kind === "original") {
    return [];
  }

  return buildV2SourcePromptBlocks({
    sourceContext,
    defaultPriority:
      isScenarioOrDeepDive && sourceContext.kind === "prior_result"
        ? "highest"
        : promptSourcePriority(sourceMode),
    protectSingleSource: isScenarioOrDeepDive && sourceContext.kind === "prior_result",
  }).map((block) => ({
    key: block.key,
    priority: block.priority,
    protected: block.protected,
    text: `${getSourceHeading(actionType, block.sourceContextKind)}\n${block.text}`,
  }));
}

async function buildPromptSnapshot(step: ExecutionStepRecord) {
  if (step.promptSnapshot?.trim()) {
    const attachments = await getAllSessionRuntimeAttachments({
      userId: step.executionRun.userId,
      sessionId: step.sessionId,
    });
    return {
      sourceTextSnapshot: step.sourceTextSnapshot ?? "",
      promptSnapshot: step.promptSnapshot,
      promptHash: step.promptHash ?? hashPrompt(step.promptSnapshot),
      attachmentsForProvider: attachmentsForProvider(attachments),
    };
  }

  const [projectContext, attachments] = await Promise.all([
    buildProjectPromptContext({
      userId: step.executionRun.userId,
      projectId: step.executionRun.session?.projectId ?? null,
      excludeSessionId: step.sessionId,
    }),
    getAllSessionRuntimeAttachments({
      userId: step.executionRun.userId,
      sessionId: step.sessionId,
    }),
  ]);

  const sourceContext = await resolveStepSource(step);
  const attachmentContext = buildAttachmentContext(attachments);
  const basePrompt = composePrompt({
    actionType: step.actionType as WorkflowStepInput["actionType"],
    originalInput: step.executionRun.session?.originalInput ?? "",
    additionalInstruction: step.executionRun.session?.additionalInstruction ?? null,
    projectContext: null,
    outputStyle: step.executionRun.session?.outputStyle ?? null,
    outputLanguage: step.executionRun.session?.outputLanguage ?? null,
    sourceContextKind: sourceContext.kind,
    sourceText: null,
    researchSourceText: sourceContext.text,
    instructionTemplate: step.instructionTemplate ?? null,
  });

  const promptBlocks = fitPromptBlocksToBudget({
    model: step.targetModel,
    blocks: [
      { key: "base", priority: "highest", text: basePrompt, protected: true },
      ...buildSourcePromptBlocks({
        actionType: step.actionType as WorkflowStepInput["actionType"],
        sourceMode: step.sourceMode,
        sourceContext,
      }),
      ...(projectContext
        ? [
            {
              key: "project",
              priority: "medium" as const,
              text: `Shared project context from related conversations:\n${projectContext}`,
            },
          ]
        : []),
      ...(attachmentContext
        ? [
            {
              key: "attachments",
              priority: "low" as const,
              text: `Attachment context:\n${attachmentContext}`,
            },
          ]
        : []),
    ],
  });

  const promptSnapshot = promptBlocks.blocks.map((block) => block.text.trim()).filter(Boolean).join("\n\n");
  return {
    sourceTextSnapshot: sourceContext.text,
    promptSnapshot,
    promptHash: hashPrompt(promptSnapshot),
    attachmentsForProvider: attachmentsForProvider(attachments),
  };
}

function startStepAbortMonitor(input: {
  stepId: string;
  executionRunId: string;
  workerId: string;
}) {
  const controller = new AbortController();
  let reason: StepAbortReason | null = null;
  let intervalHandle: ReturnType<typeof setInterval> | null = null;
  let stopped = false;
  let polling = false;

  const abortWithReason = (nextReason: StepAbortReason, message: string) => {
    if (controller.signal.aborted) {
      return;
    }

    reason = nextReason;
    const error = new Error(message);
    error.name =
      nextReason === "user_canceled" || nextReason === "run_canceled"
        ? "UserCanceledError"
        : "StepAbortError";
    controller.abort(error);
  };

  const poll = async () => {
    if (stopped || polling) {
      return;
    }

    polling = true;
    try {
      const state = await prisma.executionRunStep.findUnique({
        where: { id: input.stepId },
        select: {
          status: true,
          lockedBy: true,
          executionRun: {
            select: {
              status: true,
            },
          },
        },
      });

      if (!state) {
        abortWithReason("unknown", "The execution step no longer exists.");
        return;
      }

      if (state.executionRun.status === "canceling" || state.executionRun.status === "canceled") {
        abortWithReason("run_canceled", "The execution run was canceled.");
        return;
      }

      if (state.status !== "running") {
        abortWithReason("step_not_running", "The execution step is no longer running.");
        return;
      }

      if (state.lockedBy !== input.workerId) {
        abortWithReason("ownership_lost", "The execution step lock is no longer owned by this worker.");
        return;
      }

      await updateHeartbeat(input.stepId, input.workerId);
    } catch (error) {
      console.warn("[workbench-v2] step abort monitor failed", {
        stepId: input.stepId,
        executionRunId: input.executionRunId,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      polling = false;
    }
  };

  void poll();
  intervalHandle = setInterval(() => {
    void poll();
  }, 1_500);

  return {
    signal: controller.signal,
    stop() {
      stopped = true;
      if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
      }
    },
    getReason() {
      return reason;
    },
  } satisfies StepAbortMonitor;
}

function getProviderTimeoutOverrideSeconds(step: ExecutionStepRecord) {
  if (step.errorCode !== AI_ERROR_CODES.PROVIDER_TIMEOUT || step.attemptCount <= 1) {
    return undefined;
  }

  const timeoutPolicy = AI_ERROR_POLICY.PROVIDER_TIMEOUT;
  const baseTimeoutMs = estimateStepDurationMs({
    targetModel: step.targetModel,
    sourceMode: step.sourceMode,
  });
  const retryTimeoutMs = Math.min(
    timeoutPolicy.maxTimeoutMs,
    baseTimeoutMs * timeoutPolicy.timeoutMultiplier ** (step.attemptCount - 1),
  );

  return Math.ceil(retryTimeoutMs / 1000);
}

async function createResultForStep(input: {
  db?: Prisma.TransactionClient | typeof prisma;
  step: ExecutionStepRecord;
  status: "completed" | "failed" | "canceled" | "skipped";
  outputText?: string | null;
  errorMessage?: string | null;
  promptSnapshot: string;
  provider: string;
  model: string;
  tokenUsagePrompt?: number | null;
  tokenUsageCompletion?: number | null;
  estimatedCost?: number | null;
  costIsEstimated?: boolean | null;
  latencyMs?: number | null;
  rawResponse?: unknown;
}) {
  const db = input.db ?? prisma;
  return db.result.create({
    data: {
      sessionId: input.step.sessionId,
      executionRunId: input.step.executionRunId,
      executionOrder: input.step.orderIndex,
      workflowStepId: input.step.templateStepId,
      provider: input.provider,
      model: input.model,
      promptSnapshot: input.promptSnapshot,
      outputText: input.outputText ?? null,
      rawResponse: input.rawResponse ? JSON.stringify(input.rawResponse) : null,
      status: input.status,
      errorMessage: input.errorMessage ?? null,
      tokenUsagePrompt: input.tokenUsagePrompt ?? null,
      tokenUsageCompletion: input.tokenUsageCompletion ?? null,
      estimatedCost: input.estimatedCost ?? null,
      costIsEstimated: input.costIsEstimated ?? false,
      latencyMs: input.latencyMs ?? null,
      executionRunStep: {
        connect: {
          id: input.step.id,
        },
      },
    },
  });
}

function logStatusChange(input: {
  executionRunId: string;
  stepId: string;
  orderIndex: number;
  from: string;
  to: string;
  provider: string;
  model: string;
  attemptCount: number;
  durationMs?: number | null;
}) {
  console.info(
    JSON.stringify({
      event: "execution_run_step_status_changed",
      executionRunId: input.executionRunId,
      stepId: input.stepId,
      orderIndex: input.orderIndex,
      from: input.from,
      to: input.to,
      provider: input.provider,
      model: input.model,
      attemptCount: input.attemptCount,
      durationMs: input.durationMs ?? null,
    }),
  );
}

async function settleExecutionRunUsage(executionRunId: string) {
  const executionRun = await prisma.executionRun.findUnique({
    where: { id: executionRunId },
    include: {
      steps: {
        where: {
          result: {
            isNot: null,
          },
        },
        include: {
          result: true,
        },
      },
    },
  });

  if (!executionRun?.usageReservationId) {
    return;
  }

  const results = executionRun.steps
    .map((step) => step.result)
    .filter((result): result is NonNullable<typeof result> => Boolean(result));

  if (!results.length) {
    await releaseUsageReservation({
      reservationId: executionRun.usageReservationId,
      userId: executionRun.userId,
    }).catch(() => undefined);
    return;
  }

  const selectedModels = results.map((result) => `${result.provider}/${result.model}`);
  const inputTokenCount = results.reduce((sum, result) => sum + (result.tokenUsagePrompt ?? 0), 0);
  const outputTokenCount = results.reduce((sum, result) => sum + (result.tokenUsageCompletion ?? 0), 0);
  const estimatedCostUsd = results.reduce((sum, result) => sum + (result.estimatedCost ?? 0), 0);

  await settleUsageReservation({
    reservationId: executionRun.usageReservationId,
    userId: executionRun.userId,
    requestType: executionRun.requestType,
    selectedModels,
    inputCharCount: executionRun.inputCharCount,
    inputTokenCount,
    outputTokenCount,
    estimatedCostUsd,
  }).catch(() => undefined);
}

export async function finalizeExecutionRunV2(executionRunId: string) {
  const executionRun = await prisma.executionRun.findUnique({
    where: { id: executionRunId },
    include: {
      steps: {
        orderBy: {
          orderIndex: "asc",
        },
        include: {
          result: true,
        },
      },
    },
  });

  if (!executionRun) {
    return null;
  }

  const counts = executionRun.steps.reduce(
    (acc, step) => {
      acc[step.status as StepStatus] = (acc[step.status as StepStatus] ?? 0) + 1;
      return acc;
    },
    {
      queued: 0,
      running: 0,
      retrying: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      canceled: 0,
    } as Record<StepStatus, number>,
  );

  if (counts.queued || counts.running || counts.retrying) {
    return executionRun;
  }

  const latestCompletedResultId =
    [...executionRun.steps]
      .reverse()
      .find((step) => step.status === "completed" && step.resultId)?.resultId ?? null;

  const nextStatus =
    executionRun.status === "canceling" || executionRun.status === "canceled"
      ? "canceled"
      : counts.canceled === executionRun.steps.length
      ? "canceled"
      : counts.failed || counts.canceled || counts.skipped
        ? counts.completed
          ? "partial"
          : "failed"
        : "completed";

  const updated = await prisma.executionRun.update({
    where: { id: executionRunId },
    data: {
      status: nextStatus,
      totalStepsDone:
        counts.completed + counts.failed + counts.skipped + counts.canceled,
      finalResultId: latestCompletedResultId,
      finishedAt: now(),
      updatedAt: now(),
    },
  });

  await settleExecutionRunUsage(executionRunId);
  return updated;
}

async function getNextStep(step: ExecutionStepRecord) {
  return prisma.executionRunStep.findFirst({
    where: {
      executionRunId: step.executionRunId,
      orderIndex: { gt: step.orderIndex },
      status: { in: ["queued", "retrying"] },
    },
    orderBy: {
      orderIndex: "asc",
    },
  });
}

async function markStepQueuePublishFailed(stepId: string, error: unknown) {
  const retryAt =
    getQstashRateLimitResetAt(error) ?? new Date(Date.now() + 5 * 60 * 1000);
  const isDailyRateLimit = isQstashDailyRateLimitError(error);
  const errorMessage = isDailyRateLimit
    ? "Execution queue daily limit exceeded. This step will retry after queue capacity resets."
    : error instanceof Error
      ? error.message
      : "The execution queue could not schedule this step.";

  await prisma.executionRunStep.updateMany({
    where: {
      id: stepId,
      status: { in: ["queued", "retrying"] },
    },
    data: {
      status: "retrying",
      nextAttemptAt: retryAt,
      errorCode: isDailyRateLimit ? "QUEUE_RATE_LIMIT" : "QUEUE_PUBLISH_FAILED",
      errorMessage,
      errorRetryable: true,
      heartbeatAt: now(),
      updatedAt: now(),
    },
  });
}

async function enqueueExecutionRunStepOrMarkRetry(
  stepId: string,
  delaySeconds = 0,
) {
  try {
    await enqueueExecutionRunStep(stepId, delaySeconds);
  } catch (error) {
    await markStepQueuePublishFailed(stepId, error);
    throw error;
  }
}

async function findQueuedHandoffCandidate(input: {
  executionRunId: string;
  minStaleMs?: number;
}) {
  const executionRun = await prisma.executionRun.findUnique({
    where: { id: input.executionRunId },
    select: {
      id: true,
      status: true,
      runnerVersion: true,
      steps: {
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          orderIndex: true,
          status: true,
          nextAttemptAt: true,
          updatedAt: true,
          heartbeatAt: true,
        },
      },
    },
  });

  if (
    !executionRun ||
    executionRun.runnerVersion !== "v2" ||
    !["queued", "running", "retrying"].includes(executionRun.status)
  ) {
    return null;
  }

  if (executionRun.steps.some((step) => step.status === "running")) {
    return null;
  }

  const firstNonTerminalStep = executionRun.steps.find(
    (step) => !isTerminalStepStatus(step.status),
  );

  if (!firstNonTerminalStep) {
    await finalizeExecutionRunV2(executionRun.id);
    return null;
  }

  if (!["queued", "retrying"].includes(firstNonTerminalStep.status)) {
    return null;
  }

  const currentNow = now();
  if (
    firstNonTerminalStep.status === "retrying" &&
    firstNonTerminalStep.nextAttemptAt &&
    firstNonTerminalStep.nextAttemptAt > currentNow
  ) {
    return null;
  }

  const minStaleMs = input.minStaleMs ?? QUEUED_HANDOFF_STALE_MS;
  const lastTouchedAt =
    firstNonTerminalStep.heartbeatAt ?? firstNonTerminalStep.updatedAt;
  if (
    minStaleMs > 0 &&
    currentNow.getTime() - lastTouchedAt.getTime() < minStaleMs
  ) {
    return null;
  }

  return firstNonTerminalStep;
}

export async function rescueStalledExecutionRunV2(input: {
  executionRunId: string;
  minStaleMs?: number;
}) {
  const candidate = await findQueuedHandoffCandidate(input);
  if (!candidate) {
    return { rescued: 0, stepId: null as string | null };
  }

  const currentNow = now();
  const updated = await prisma.executionRunStep.updateMany({
    where: {
      id: candidate.id,
      status: candidate.status,
      OR: [{ heartbeatAt: candidate.heartbeatAt }, { heartbeatAt: null }],
    },
    data: {
      heartbeatAt: currentNow,
      updatedAt: currentNow,
    },
  });

  if (!updated.count) {
    return { rescued: 0, stepId: null as string | null };
  }

  await enqueueExecutionRunStepOrMarkRetry(candidate.id);
  console.info(
    JSON.stringify({
      event: "execution_run_step_handoff_rescued",
      executionRunId: input.executionRunId,
      stepId: candidate.id,
      orderIndex: candidate.orderIndex,
      status: candidate.status,
    }),
  );

  return { rescued: 1, stepId: candidate.id };
}

export async function rescueStalledQueuedExecutionRunStepsV2(input: {
  take?: number;
  minStaleMs?: number;
} = {}) {
  const runs = await prisma.executionRun.findMany({
    where: {
      runnerVersion: "v2",
      status: { in: ["queued", "running", "retrying"] },
      steps: {
        some: {
          status: { in: ["queued", "retrying"] },
        },
        none: {
          status: "running",
        },
      },
    },
    orderBy: { updatedAt: "asc" },
    take: input.take ?? 25,
    select: { id: true },
  });

  let rescued = 0;
  let failed = 0;

  for (const run of runs) {
    try {
      const result = await rescueStalledExecutionRunV2({
        executionRunId: run.id,
        minStaleMs: input.minStaleMs,
      });
      rescued += result.rescued;
    } catch (error) {
      failed += 1;
      console.error(
        JSON.stringify({
          event: "execution_run_step_handoff_rescue_failed",
          executionRunId: run.id,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  return { scannedQueuedRuns: runs.length, queuedRescued: rescued, rescueFailed: failed };
}

async function transitionStepToCompleted(input: {
  step: ExecutionStepRecord;
  workerId: string;
  providerResult: Awaited<ReturnType<typeof callProvider>>;
  promptSnapshot: string;
}) {
  const transitioned = await prisma.$transaction(async (tx) => {
    const currentNow = now();
    const updated = await tx.executionRunStep.updateMany({
      where: {
        id: input.step.id,
        lockedBy: input.workerId,
        status: "running",
      },
      data: {
        status: "completed",
        completedAt: currentNow,
        heartbeatAt: currentNow,
        lockExpiresAt: null,
        lockedBy: null,
        errorCode: null,
        errorMessage: null,
        errorRetryable: false,
        updatedAt: currentNow,
      },
    });

    if (!updated.count) {
      return false;
    }

    const result = await createResultForStep({
      db: tx,
      step: input.step,
      status: "completed",
      outputText: input.providerResult.outputText,
      promptSnapshot: input.promptSnapshot,
      provider: input.providerResult.provider,
      model: input.providerResult.model,
      tokenUsagePrompt: input.providerResult.usage?.promptTokens ?? null,
      tokenUsageCompletion: input.providerResult.usage?.completionTokens ?? null,
      estimatedCost: input.providerResult.estimatedCost ?? null,
      costIsEstimated: input.providerResult.costIsEstimated ?? false,
      latencyMs: input.providerResult.latencyMs,
      rawResponse: input.providerResult.rawResponse,
    });

    await tx.aiRequest.create({
      data: {
        userId: input.step.executionRun.userId,
        conversationId: input.step.executionRun.sessionId,
        messageId: result.id,
        provider: input.providerResult.provider,
        model: input.providerResult.model,
        requestType: input.step.actionType,
        status: "completed",
        inputTokens: input.providerResult.usage?.promptTokens ?? null,
        outputTokens: input.providerResult.usage?.completionTokens ?? null,
        estimatedCostUsd: input.providerResult.estimatedCost ?? null,
        latencyMs: input.providerResult.latencyMs,
        errorCode: null,
        errorMessage: null,
      },
    });

    await tx.executionRunStep.updateMany({
      where: {
        id: input.step.id,
        status: "completed",
        resultId: null,
      },
      data: {
        resultId: result.id,
        updatedAt: now(),
      },
    });

    return true;
  });

  if (!transitioned) {
    return false;
  }

  logStatusChange({
    executionRunId: input.step.executionRunId,
    stepId: input.step.id,
    orderIndex: input.step.orderIndex,
    from: "running",
    to: "completed",
    provider: input.step.targetProvider,
    model: input.step.targetModel,
    attemptCount: input.step.attemptCount + 1,
    durationMs: input.providerResult.latencyMs,
  });

  return true;
}

async function transitionStepToRetrying(input: {
  step: ExecutionStepRecord;
  workerId: string;
  errorCode: string;
  errorMessage: string;
  retryDelayMs: number;
}) {
  const retryAt = new Date(Date.now() + input.retryDelayMs);

  const updated = await prisma.executionRunStep.updateMany({
    where: {
      id: input.step.id,
      lockedBy: input.workerId,
      status: "running",
    },
    data: {
      status: "retrying",
      nextAttemptAt: retryAt,
      heartbeatAt: now(),
      lockExpiresAt: null,
      lockedBy: null,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      errorRetryable: true,
      updatedAt: now(),
    },
  });

  if (!updated.count) {
    return false;
  }

  logStatusChange({
    executionRunId: input.step.executionRunId,
    stepId: input.step.id,
    orderIndex: input.step.orderIndex,
    from: "running",
    to: "retrying",
    provider: input.step.targetProvider,
    model: input.step.targetModel,
    attemptCount: input.step.attemptCount + 1,
  });

  return true;
}

async function transitionStepToTerminal(input: {
  step: ExecutionStepRecord;
  workerId: string;
  status: "failed" | "canceled" | "skipped";
  errorCode: string;
  errorMessage: string;
  promptSnapshot: string;
}) {
  const transitioned = await prisma.$transaction(async (tx) => {
    const currentNow = now();
    const dateField =
      input.status === "canceled"
        ? { canceledAt: currentNow }
        : input.status === "skipped"
          ? {}
          : { failedAt: currentNow };

    const updated = await tx.executionRunStep.updateMany({
      where: {
        id: input.step.id,
        lockedBy: input.workerId,
        status: "running",
      },
      data: {
        status: input.status,
        heartbeatAt: currentNow,
        lockExpiresAt: null,
        lockedBy: null,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        errorRetryable: false,
        updatedAt: currentNow,
        ...dateField,
      },
    });

    if (!updated.count) {
      return false;
    }

    const result = await createResultForStep({
      db: tx,
      step: input.step,
      status: input.status,
      outputText: null,
      errorMessage: input.errorMessage,
      promptSnapshot: input.promptSnapshot,
      provider: input.step.targetProvider,
      model: input.step.targetModel,
    });

    await tx.executionRunStep.updateMany({
      where: {
        id: input.step.id,
        status: input.status,
        resultId: null,
      },
      data: {
        resultId: result.id,
        updatedAt: now(),
      },
    });

    return true;
  });

  if (!transitioned) {
    return false;
  }

  logStatusChange({
    executionRunId: input.step.executionRunId,
    stepId: input.step.id,
    orderIndex: input.step.orderIndex,
    from: "running",
    to: input.status,
    provider: input.step.targetProvider,
    model: input.step.targetModel,
    attemptCount: input.step.attemptCount + 1,
  });

  return true;
}

export async function executeSingleRunStep(input: {
  stepId: string;
  workerId: string;
}) {
  const step = await claimExecutionRunStep(input.stepId, input.workerId);
  if (!step) {
    return {
      claimed: false as const,
    };
  }

  await prisma.executionRun.updateMany({
    where: {
      id: step.executionRunId,
      status: { in: ["queued", "retrying"] },
    },
    data: {
      status: "running",
      startedAt: step.executionRun.startedAt ?? now(),
      updatedAt: now(),
    },
  });

  const executionRun = step.executionRun;
  if (!executionRun.session) {
    await transitionStepToTerminal({
      step,
      workerId: input.workerId,
      status: "failed",
      errorCode: AI_ERROR_CODES.UNKNOWN,
      errorMessage: "The workbench session could not be loaded.",
      promptSnapshot: step.promptSnapshot || "",
    });
    await finalizeExecutionRunV2(step.executionRunId);
    return { claimed: true as const, shouldContinue: false as const, executionRunId: step.executionRunId };
  }

  if (executionRun.status === "canceled" || executionRun.status === "canceling") {
    await transitionStepToTerminal({
      step,
      workerId: input.workerId,
      status: "canceled",
      errorCode: AI_ERROR_CODES.USER_CANCELED,
      errorMessage: "사용자가 작업을 중지했습니다.",
      promptSnapshot: step.promptSnapshot || "",
    });
    await finalizeExecutionRunV2(step.executionRunId);
    return { claimed: true as const, shouldContinue: false as const, executionRunId: step.executionRunId };
  }

  const promptData = await buildPromptSnapshot(step);
  await prisma.executionRunStep.update({
    where: { id: step.id },
    data: {
      sourceTextSnapshot: step.sourceTextSnapshot ?? promptData.sourceTextSnapshot,
      promptSnapshot: step.promptSnapshot ?? promptData.promptSnapshot,
      promptHash: step.promptHash ?? promptData.promptHash,
      heartbeatAt: now(),
    },
  });
  const abortMonitor = startStepAbortMonitor({
    stepId: step.id,
    executionRunId: step.executionRunId,
    workerId: input.workerId,
  });

  let providerResult;
  try {
    providerResult = await callProvider(executionRun.userId, {
      provider: step.targetProvider as ProviderName,
      model: step.targetModel,
      requestType: step.actionType as WorkflowStepInput["actionType"],
      prompt: step.promptSnapshot ?? promptData.promptSnapshot,
      attachments: promptData.attachmentsForProvider,
      allowFallback: false,
      disableInternalRetries: true,
      enableWebSearch: shouldEnableProviderWebSearch({
        requestType: step.actionType as WorkflowStepInput["actionType"],
        prompt: step.promptSnapshot ?? promptData.promptSnapshot,
      }),
      timeoutSecondsOverride: getProviderTimeoutOverrideSeconds(step),
      abortSignal: abortMonitor.signal,
      concurrencyOwner: {
        ownerKind: "execution_run_step",
        ownerId: step.attemptKey || buildAttemptKey(step.executionRunId, step.orderIndex, step.attemptCount + 1),
      },
    });
  } finally {
    abortMonitor.stop();
  }

  const abortReason = abortMonitor.getReason();

  if (abortReason === "ownership_lost" || abortReason === "step_not_running") {
    return {
      claimed: true as const,
      shouldContinue: false as const,
      executionRunId: step.executionRunId,
    };
  }

  if (providerResult.status === "completed" && providerResult.outputText.trim()) {
    const transitioned = await transitionStepToCompleted({
      step,
      workerId: input.workerId,
      providerResult,
      promptSnapshot: step.promptSnapshot ?? promptData.promptSnapshot,
    });
    if (!transitioned) {
      return {
        claimed: true as const,
        shouldContinue: false as const,
        executionRunId: step.executionRunId,
      };
    }
  } else {
    const normalizedError =
      abortReason === "user_canceled" || abortReason === "run_canceled"
        ? {
            code: AI_ERROR_CODES.USER_CANCELED,
            message: AI_ERROR_POLICY.USER_CANCELED.userMessage,
            retryable: false,
          }
        : normalizeAiError(
            new Error(providerResult.errorMessage || "Provider request failed."),
          );
    const maxAttempts =
      normalizedError.code in AI_ERROR_POLICY
        ? (AI_ERROR_POLICY[normalizedError.code as keyof typeof AI_ERROR_POLICY] as { maxAttempts?: number }).maxAttempts ?? step.maxAttempts
        : step.maxAttempts;
    const canRetry =
      normalizedError.retryable &&
      step.attemptCount < maxAttempts &&
      executionRun.status !== "canceling" &&
      executionRun.status !== "canceled";

    if (canRetry) {
      const retryDelayMs = computeRetryDelayMs(
        normalizedError.code,
        step.attemptCount + 1,
      );
      const transitioned = await transitionStepToRetrying({
        step,
        workerId: input.workerId,
        errorCode: normalizedError.code,
        errorMessage: normalizedError.message,
        retryDelayMs,
      });
      if (!transitioned) {
        return {
          claimed: true as const,
          shouldContinue: false as const,
          executionRunId: step.executionRunId,
        };
      }
      await enqueueExecutionRunStepOrMarkRetry(
        step.id,
        Math.max(1, Math.ceil(retryDelayMs / 1000)),
      );
      return {
        claimed: true as const,
        shouldContinue: false as const,
        executionRunId: step.executionRunId,
      };
    }

    const transitioned = await transitionStepToTerminal({
      step,
      workerId: input.workerId,
      status:
        normalizedError.code === AI_ERROR_CODES.USER_CANCELED ? "canceled" : "failed",
      errorCode: normalizedError.code,
      errorMessage: normalizedError.message,
      promptSnapshot: step.promptSnapshot ?? promptData.promptSnapshot,
    });
    if (!transitioned) {
      return {
        claimed: true as const,
        shouldContinue: false as const,
        executionRunId: step.executionRunId,
      };
    }
  }

  const nextStep = await getNextStep(step);
  if (!nextStep) {
    await finalizeExecutionRunV2(step.executionRunId);
    return {
      claimed: true as const,
      shouldContinue: false as const,
      executionRunId: step.executionRunId,
    };
  }

  return {
    claimed: true as const,
    shouldContinue: true as const,
    executionRunId: step.executionRunId,
    nextStep,
  };
}

export async function executeStepWithContinuation(input: {
  stepId: string;
  workerId?: string;
  invocationStartedAt?: number;
}) {
  const workerId = input.workerId ?? crypto.randomUUID();
  const invocationStartedAt = input.invocationStartedAt ?? Date.now();
  const outcome = await executeSingleRunStep({
    stepId: input.stepId,
    workerId,
  });

  if (!outcome.claimed) {
    const step = await prisma.executionRunStep.findUnique({
      where: { id: input.stepId },
      select: { executionRunId: true },
    });
    if (step) {
      await rescueStalledExecutionRunV2({
        executionRunId: step.executionRunId,
        minStaleMs: 0,
      }).catch(() => undefined);
    }
  }

  if (!outcome.claimed || !outcome.shouldContinue || !outcome.nextStep) {
    return outcome;
  }

  const elapsedMs = Date.now() - invocationStartedAt;
  const remainingBudgetMs = FUNCTION_MAX_MS - elapsedMs;
  const expectedNextStepMs = estimateStepDurationMs({
    targetModel: outcome.nextStep.targetModel,
    sourceMode: outcome.nextStep.sourceMode,
  });

  if (
    remainingBudgetMs > expectedNextStepMs + SAFETY_MARGIN_MS &&
    canInlineContinue({
      targetModel: outcome.nextStep.targetModel,
      sourceMode: outcome.nextStep.sourceMode,
    })
  ) {
    return executeStepWithContinuation({
      stepId: outcome.nextStep.id,
      workerId,
      invocationStartedAt,
    });
  }

  await enqueueExecutionRunStepOrMarkRetry(outcome.nextStep.id);
  return outcome;
}

export async function getExecutionRunStatusSnapshot(input: {
  executionRunId: string;
  userId: string;
}) {
  const executionRun = await prisma.executionRun.findFirst({
    where: {
      id: input.executionRunId,
      userId: input.userId,
    },
    include: {
      steps: {
        orderBy: {
          orderIndex: "asc",
        },
        include: {
          result: {
            select: {
              id: true,
              outputText: true,
              status: true,
              provider: true,
              model: true,
              latencyMs: true,
            },
          },
        },
      },
    },
  });

  if (!executionRun) {
    return null;
  }

  const totals = executionRun.steps.reduce(
    (acc, step) => {
      if (step.status === "completed") {
        acc.totalStepsDone += 1;
      }
      if (step.status === "failed") {
        acc.totalStepsFailed += 1;
      }
      if (step.status === "running") {
        acc.totalStepsRunning += 1;
      }
      if (step.status === "canceled") {
        acc.totalStepsCanceled += 1;
      }
      return acc;
    },
    {
      totalStepsDone: 0,
      totalStepsFailed: 0,
      totalStepsRunning: 0,
      totalStepsCanceled: 0,
    },
  );

  return {
    executionRun: {
      id: executionRun.id,
      status: executionRun.status,
      runnerVersion: executionRun.runnerVersion,
      totalStepsPlanned: executionRun.totalStepsPlanned,
      ...totals,
      finalResultId: executionRun.finalResultId,
    },
    runSteps: executionRun.steps.map((step) => ({
      id: step.id,
      orderIndex: step.orderIndex,
      templateStepIndex: step.templateStepIndex,
      actionType: step.actionType,
      targetProvider: step.targetProvider,
      targetModel: step.targetModel,
      sourceMode: step.sourceMode,
      repeatIteration: step.repeatIteration,
      repeatBlockIndex: step.repeatBlockIndex,
      status: step.status,
      attemptCount: step.attemptCount,
      startedAt: step.startedAt?.toISOString() ?? null,
      completedAt: step.completedAt?.toISOString() ?? null,
      failedAt: step.failedAt?.toISOString() ?? null,
      errorCode: step.errorCode,
      errorMessage: step.errorMessage,
      sourceTextSnapshotPreview: previewText(step.sourceTextSnapshot),
      promptSnapshotPreview: previewText(step.promptSnapshot),
      result: step.result
        ? {
            id: step.result.id,
            outputText: step.result.outputText,
            status: step.result.status,
            provider: step.result.provider,
            model: step.result.model,
            latencyMs: step.result.latencyMs,
          }
        : null,
    })),
  };
}

export async function cancelExecutionRunV2(input: {
  executionRunId: string;
  userId: string;
  reason?: string;
}) {
  const executionRun = await prisma.executionRun.findFirst({
    where: {
      id: input.executionRunId,
      userId: input.userId,
    },
  });

  if (!executionRun) {
    return null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.executionRun.update({
      where: { id: input.executionRunId },
      data: {
        status: "canceling",
        errorMessage: input.reason ?? "The run was stopped by the user.",
      },
    });

    await tx.executionRunStep.updateMany({
      where: {
        executionRunId: input.executionRunId,
        status: { in: ["queued", "retrying"] },
      },
      data: {
        status: "canceled",
        canceledAt: now(),
        errorCode: AI_ERROR_CODES.USER_CANCELED,
        errorMessage: input.reason ?? "사용자가 작업을 중지했습니다.",
        errorRetryable: false,
      },
    });
  });

  const runningSteps = await prisma.executionRunStep.findMany({
    where: {
      executionRunId: input.executionRunId,
      status: "running",
    },
  });

  if (runningSteps.length) {
    await prisma.executionRunStep.updateMany({
      where: {
        executionRunId: input.executionRunId,
        status: "running",
      },
      data: {
        errorCode: AI_ERROR_CODES.USER_CANCELED,
        errorMessage: input.reason ?? AI_ERROR_POLICY.USER_CANCELED.userMessage,
        errorRetryable: false,
        updatedAt: now(),
      },
    });
  }

  if (!runningSteps.length) {
    await finalizeExecutionRunV2(input.executionRunId);
  }

  return prisma.executionRun.findUnique({
    where: { id: input.executionRunId },
  });
}

export async function cancelExecutionRunStepV2(input: {
  executionRunId: string;
  userId: string;
  orderIndex: number;
}) {
  const executionRun = await prisma.executionRun.findFirst({
    where: {
      id: input.executionRunId,
      userId: input.userId,
    },
  });

  if (!executionRun) {
    return null;
  }

  const step = await prisma.executionRunStep.findFirst({
    where: {
      executionRunId: input.executionRunId,
      orderIndex: input.orderIndex + 1,
    },
  });

  if (!step) {
    return null;
  }

  if (step.status === "queued" || step.status === "retrying") {
    await prisma.executionRunStep.update({
      where: { id: step.id },
      data: {
        status: "canceled",
        canceledAt: now(),
        errorCode: AI_ERROR_CODES.USER_CANCELED,
        errorMessage: "사용자 요청으로 해당 단계가 중지되었습니다.",
        errorRetryable: false,
      },
    });
    await finalizeExecutionRunV2(input.executionRunId);
    return { executionRunId: input.executionRunId, stepId: step.id, status: "canceled" };
  }

  if (step.status === "running") {
    return { executionRunId: input.executionRunId, stepId: step.id, status: "running" };
  }

  return { executionRunId: input.executionRunId, stepId: step.id, status: step.status };
}

export async function runExecutionRunStepWatchdog() {
  const [lock] = await prisma.$queryRaw<Array<{ locked: boolean }>>`
    SELECT pg_try_advisory_lock(hashtext('workbench_watchdog')) AS locked
  `;

  if (!lock?.locked) {
    return { scanned: 0, stale: 0, skipped: true };
  }

  try {
    const providerTimeoutMs = 5 * 60 * 1000;
    const graceMs = 60 * 1000;
    const staleBefore = new Date(Date.now() - providerTimeoutMs - graceMs);
    const staleSteps = await prisma.executionRunStep.findMany({
      where: {
        status: "running",
        OR: [
          { heartbeatAt: { lt: staleBefore } },
          {
            heartbeatAt: null,
            startedAt: { lt: staleBefore },
          },
        ],
      },
      include: {
        executionRun: {
          include: {
            session: true,
          },
        },
      },
      orderBy: {
        updatedAt: "asc",
      },
      take: 20,
    });

    for (const step of staleSteps) {
      const updated = await prisma.executionRunStep.updateMany({
        where: {
          id: step.id,
          status: "running",
          lockedBy: step.lockedBy,
        },
        data: {
          status: "failed",
          failedAt: now(),
          errorCode: AI_ERROR_CODES.STEP_STALE_TIMEOUT,
          errorMessage: AI_ERROR_POLICY.STEP_STALE_TIMEOUT.userMessage,
          errorRetryable: false,
          lockedBy: null,
          lockExpiresAt: null,
          heartbeatAt: now(),
        },
      });

      if (!updated.count) {
        continue;
      }

      const promptSnapshot = step.promptSnapshot || "";
      await prisma.$transaction(async (tx) => {
        const result = await tx.result.create({
          data: {
            sessionId: step.sessionId,
            executionRunId: step.executionRunId,
            executionOrder: step.orderIndex,
            workflowStepId: step.templateStepId,
            provider: step.targetProvider,
            model: step.targetModel,
            promptSnapshot,
            outputText: null,
            rawResponse: null,
            status: "failed",
            errorMessage: AI_ERROR_POLICY.STEP_STALE_TIMEOUT.userMessage,
            executionRunStep: {
              connect: {
                id: step.id,
              },
            },
          },
        });

        await tx.executionRunStep.updateMany({
          where: {
            id: step.id,
            status: "failed",
            resultId: null,
          },
          data: {
            resultId: result.id,
            updatedAt: now(),
          },
        });
      }).catch(() => undefined);

      const nextStep = await getNextStep(step as ExecutionStepRecord);
      if (nextStep) {
        await enqueueExecutionRunStepOrMarkRetry(nextStep.id).catch(() => undefined);
      }
      await finalizeExecutionRunV2(step.executionRunId);
    }

    const queuedRescue = await rescueStalledQueuedExecutionRunStepsV2({
      take: 25,
      minStaleMs: QUEUED_HANDOFF_STALE_MS,
    });
    const activeRunCount = await prisma.executionRun.count({
      where: {
        runnerVersion: "v2",
        status: { in: ["queued", "running", "retrying"] },
      },
    });

    return {
      scanned: staleSteps.length,
      stale: staleSteps.length,
      skipped: false,
      activeRunCount,
      ...queuedRescue,
    };
  } finally {
    await prisma.$executeRaw`SELECT pg_advisory_unlock(hashtext('workbench_watchdog'))`;
  }
}
