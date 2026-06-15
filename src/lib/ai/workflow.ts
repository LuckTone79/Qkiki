import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  claimSessionAttachments,
  getAllSessionRuntimeAttachments,
  hydrateRuntimeAttachments,
  type RuntimeAttachment,
} from "@/lib/attachments";
import { composePrompt, composeImagePrompt } from "@/lib/ai/prompt";
import { isImageModel } from "@/lib/ai/provider-catalog";
import { isImageDataUrl, stripImageDataUrlForText } from "@/lib/ai/image-output";
import { callProvider } from "@/lib/ai/providers";
import { getParallelComparisonSummaryTarget } from "@/lib/ai/summary-model";
import { expandWorkflowSteps } from "@/lib/ai/workflow-control";
import { encryptTextContent } from "@/lib/secret-crypto";
import {
  ensureResultExecutionOrderColumn,
  ensureResultExecutionRunIdColumn,
} from "@/lib/workbench-run-schema";
import { shouldAllowConfiguredProviderFallback } from "@/lib/workbench-provider-fallback";
import {
  ensureWorkflowControlJsonColumn,
  ensureWorkflowTemplateStepsJsonColumn,
} from "@/lib/workbench-session-schema";
import type {
  ActionType,
  ProviderName,
  SourceMode,
  WorkflowControlInput,
  TargetModelInput,
  WorkflowStepInput,
} from "@/lib/ai/types";

type SessionInput = {
  sessionId?: string | null;
  projectId?: string | null;
  title?: string | null;
  originalInput: string;
  additionalInstruction?: string | null;
  outputStyle?: string | null;
  outputLanguage?: string | null;
  workflowControl?: WorkflowControlInput;
  workflowTemplateSteps?: WorkflowStepInput[];
  mode: string;
  attachmentIds?: string[];
};

type ExecutePersistInput = {
  userId: string;
  sessionId: string;
  executionRunId?: string | null;
  executionOrder?: number | null;
  workflowStepId?: string | null;
  workflowStepData?: WorkflowStepPersistInput | null;
  parentResultId?: string | null;
  branchKey?: string | null;
  provider: ProviderName;
  model: string;
  requestType: ActionType | "rerun";
  prompt: string;
  attachments?: RuntimeAttachment[];
  allowFallback?: boolean;
  abortSignal?: AbortSignal;
  canceledErrorMessage?: string;
  onStarted?: (result: PersistedWorkbenchResult) => void | Promise<void>;
};

const MAX_PROJECT_CONTEXT_CHARS = 6000;
const MAX_SOURCE_TEXT_CHARS = 12000;
const STEP_STOP_POLL_MS = 750;
const EXISTING_STEP_POLL_MS = 1000;
const STEP_STOP_MESSAGE = "Step stopped by user request.";
const RUN_STOP_MESSAGE = "Run stopped by user request.";
const EXISTING_STEP_STILL_RUNNING_REASON = "existing_step_still_running";
const MAX_INITIAL_SEQUENTIAL_RECOVERY_FAILURES = 2;
const MAX_SEQUENTIAL_CONSECUTIVE_FAILURES = 3;

type ExpandedWorkflowStep = {
  executionOrder: number;
  templateStep: WorkflowStepInput;
};

type IncrementalProgressEvent = {
  index: number;
  title: string;
  subtitle: string;
  actionType?: ActionType;
  detail?: string;
};

type PersistedWorkbenchResult = Prisma.ResultGetPayload<{
  include: {
    workflowStep: {
      select: {
        orderIndex: true;
        actionType: true;
      };
    };
  };
}>;

type WorkflowStepPersistInput = {
  sessionId: string;
  orderIndex: number;
  actionType: ActionType;
  targetProvider: ProviderName;
  targetModel: string;
  sourceMode: SourceMode;
  sourceResultId?: string | null;
  instructionTemplate?: string | null;
};

function buildWorkflowStepPersistInput(input: {
  sessionId: string;
  executionOrder: number;
  step: WorkflowStepInput;
}) {
  return {
    sessionId: input.sessionId,
    orderIndex: input.executionOrder,
    actionType: input.step.actionType,
    targetProvider: input.step.targetProvider,
    targetModel: input.step.targetModel,
    sourceMode: input.step.sourceMode,
    sourceResultId: input.step.sourceResultId || null,
    instructionTemplate: input.step.instructionTemplate || null,
  } satisfies WorkflowStepPersistInput;
}

function serializeWorkflowTemplateSteps(steps: WorkflowStepInput[] | undefined) {
  if (!steps?.length) {
    return null;
  }

  return JSON.stringify(
    steps.map((step, index) => ({
      orderIndex: index + 1,
      actionType: step.actionType,
      targetProvider: step.targetProvider,
      targetModel: step.targetModel,
      sourceMode: step.sourceMode,
      sourceResultId: step.sourceResultId ?? null,
      instructionTemplate: step.instructionTemplate ?? null,
    })),
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type IncrementalRunCallbacks = {
  onSession?: (session: Awaited<ReturnType<typeof upsertWorkbenchSession>>) => void | Promise<void>;
  onStepStart?: (event: IncrementalProgressEvent) => void | Promise<void>;
  onStepSkipped?: (event: IncrementalProgressEvent) => void | Promise<void>;
  onResultStart?: (event: {
    index: number;
    result: PersistedWorkbenchResult;
  }) => void | Promise<void>;
  onResult?: (event: {
    index: number;
    result: PersistedWorkbenchResult;
  }) => void | Promise<void>;
  shouldStop?: () => boolean | Promise<boolean>;
  shouldStopStep?: (index: number) => boolean | Promise<boolean>;
};

function createAbortError(message: string) {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function createPolledAbortController(input: {
  shouldAbort?: () => boolean | Promise<boolean>;
  message: string;
}) {
  const controller = new AbortController();
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cleanup = () => {
    disposed = true;
    if (timer) {
      clearTimeout(timer);
    }
  };

  const poll = async () => {
    if (disposed || controller.signal.aborted || !input.shouldAbort) {
      return;
    }

    try {
      if (await input.shouldAbort()) {
        controller.abort(createAbortError(input.message));
        return;
      }
    } catch {
      if (!disposed && !controller.signal.aborted) {
        timer = setTimeout(() => void poll(), STEP_STOP_POLL_MS);
      }
      return;
    }

    if (!disposed && !controller.signal.aborted) {
      timer = setTimeout(() => void poll(), STEP_STOP_POLL_MS);
    }
  };

  void poll();

  return {
    signal: controller.signal,
    cleanup,
  };
}

export function pickFinalResultId(results: Array<{ id: string; status: string }>) {
  return [...results].reverse().find((result) => result.status === "completed")?.id ?? null;
}

function defaultTitle(input: string) {
  const compact = input.replace(/\s+/g, " ").trim();
  return compact.length > 70 ? `${compact.slice(0, 67)}...` : compact;
}

function truncatePromptContext(
  text: string,
  maxChars: number,
  label: string,
) {
  const compact = text.trim();
  if (compact.length <= maxChars) {
    return compact;
  }

  return [
    compact.slice(0, maxChars).trim(),
    "",
    `[${label} was truncated after ${maxChars} characters to keep this run stable and responsive.]`,
  ].join("\n");
}

async function resolveProjectId(userId: string, projectId?: string | null) {
  if (!projectId) {
    return null;
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });

  if (!project) {
    throw new Error("Project was not found for this account.");
  }

  return project.id;
}

export async function buildProjectPromptContext(input: {
  userId: string;
  projectId?: string | null;
  excludeSessionId?: string | null;
}) {
  if (!input.projectId) {
    return null;
  }

  const project = await prisma.project.findFirst({
    where: { id: input.projectId, userId: input.userId },
    select: {
      name: true,
      description: true,
      sharedContext: true,
    },
  });

  if (!project) {
    return null;
  }

  await ensureResultExecutionRunIdColumn();
  const recentResults = await prisma.result.findMany({
    where: {
      status: "completed",
      outputText: { not: null },
      session: {
        userId: input.userId,
        projectId: input.projectId,
        ...(input.excludeSessionId ? { id: { not: input.excludeSessionId } } : {}),
      },
    },
    include: {
      session: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  const parts = [
    `Project: ${project.name}`,
    project.description ? `Project description: ${project.description}` : "",
    project.sharedContext
      ? `Project default AI guideline: ${project.sharedContext}`
      : "",
  ].filter(Boolean);

  if (recentResults.length) {
    parts.push(
      "Recent linked conversation outputs:",
      recentResults
        .map((result, index) =>
          [
            `${index + 1}. ${result.session.title} (${result.provider}/${result.model})`,
            (result.outputText ?? "").slice(0, 1200),
          ].join("\n"),
        )
        .join("\n\n"),
    );
  }

  return truncatePromptContext(
    parts.join("\n\n"),
    MAX_PROJECT_CONTEXT_CHARS,
    "Project context",
  );
}

export function buildExpandedSteps(
  steps: WorkflowStepInput[],
  workflowControl?: WorkflowControlInput,
) {
  return expandWorkflowSteps(steps, workflowControl).map((step, index): ExpandedWorkflowStep => ({
    executionOrder: index + 1,
    templateStep: step,
  }));
}

function composeParallelTargetPrompt(input: {
  provider: ProviderName;
  model: string;
  originalInput: string;
  additionalInstruction?: string | null;
  projectContext?: string | null;
  outputStyle?: string | null;
  outputLanguage?: string | null;
}) {
  if (isImageModel(input.provider, input.model)) {
    return composeImagePrompt({
      originalInput: input.originalInput,
      additionalInstruction: input.additionalInstruction,
      outputStyle: input.outputStyle,
    });
  }

  return composePrompt({
    actionType: "generate",
    originalInput: input.originalInput,
    additionalInstruction: input.additionalInstruction,
    projectContext: input.projectContext,
    outputStyle: input.outputStyle,
    outputLanguage: input.outputLanguage,
  });
}

function getQualityDirective(threshold: number) {
  return [
    "Self-evaluate this response quality from 0 to 100.",
    `If the quality is ${threshold} or higher, add a final line exactly as: QUALITY_SCORE: <number>`,
    "If lower than threshold, still add that final line with the current score.",
  ].join("\n");
}

export function extractQualityScore(text: string | null | undefined) {
  if (!text) {
    return null;
  }

  const patterns = [
    /QUALITY_SCORE\s*[:=]\s*(\d{1,3})/i,
    /quality\s*score\s*[:=]\s*(\d{1,3})/i,
    /\uD488\uC9C8\s*\uC810\uC218\s*[:=]\s*(\d{1,3})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const score = Number(match[1]);
      if (!Number.isNaN(score)) {
        return Math.max(0, Math.min(100, score));
      }
    }
  }

  return null;
}

export function stripQualityScoreLine(text: string | null | undefined) {
  if (!text) {
    return "";
  }

  return text
    .split("\n")
    .filter((line) => !/QUALITY_SCORE\s*[:=]\s*\d{1,3}/i.test(line))
    .join("\n")
    .trim();
}

function buildFailedStepRecoverySource(input: {
  originalInput: string;
  stepNumber: number;
  provider: ProviderName;
  model: string;
  errorMessage?: string | null;
}) {
  return truncatePromptContext(
    [
      "The previous sequential step failed before producing usable output.",
      `Failed step: ${input.stepNumber} (${input.provider}/${input.model})`,
      `Failure: ${input.errorMessage || "Unknown provider failure."}`,
      "",
      "Continue the workflow from the original task instead. Produce the best possible output for the next step, and briefly account for the missing previous output if needed.",
      "",
      "[Original task]",
      input.originalInput,
    ].join("\n"),
    MAX_SOURCE_TEXT_CHARS,
    "Recovery source",
  );
}

export async function updateResultOutputText(resultId: string, outputText: string) {
  await ensureResultExecutionRunIdColumn();
  const encryptedOutput =
    outputText && outputText.trim()
      ? encryptTextContent(outputText)
      : null;

  await prisma.result.update({
    where: { id: resultId },
    data: {
      outputText: outputText || null,
      outputTextCiphertext: encryptedOutput?.ciphertext ?? null,
      outputTextIv: encryptedOutput?.iv ?? null,
      outputTextTag: encryptedOutput?.tag ?? null,
    },
  });
}

async function findExecutionStepResult(input: {
  executionRunId?: string | null;
  sessionId: string;
  executionOrder: number;
}) {
  if (!input.executionRunId) {
    return null;
  }

  await ensureResultExecutionRunIdColumn();
  await ensureResultExecutionOrderColumn();
  return prisma.result.findFirst({
    where: {
      executionRunId: input.executionRunId,
      sessionId: input.sessionId,
      executionOrder: input.executionOrder,
    },
    orderBy: [
      { updatedAt: "desc" },
      { createdAt: "desc" },
    ],
    include: {
      workflowStep: {
        select: { orderIndex: true, actionType: true },
      },
    },
  });
}

async function waitForExecutionStepResult(input: {
  executionRunId?: string | null;
  sessionId: string;
  executionOrder: number;
  shouldStop?: () => boolean | Promise<boolean>;
  shouldStopStep?: (index: number) => boolean | Promise<boolean>;
}) {
  const existing = await findExecutionStepResult(input);
  if (!existing) {
    return null;
  }

  const stepIndex = input.executionOrder - 1;
  if (existing.status !== "running") {
    return existing;
  }

  while (true) {
    if (
      (await input.shouldStop?.()) ||
      (await input.shouldStopStep?.(stepIndex))
    ) {
      return existing;
    }

    await sleep(EXISTING_STEP_POLL_MS);
    const refreshed = await findExecutionStepResult(input);
    if (!refreshed || refreshed.status !== "running") {
      return refreshed ?? existing;
    }
  }
}

function toProviderAttachments(attachments: RuntimeAttachment[] | undefined) {
  return (attachments || []).map((attachment) => ({
    id: attachment.id,
    name: attachment.name,
    mimeType: attachment.mimeType,
    kind: attachment.kind,
    sizeBytes: attachment.sizeBytes,
    extractedText: attachment.extractedText,
    dataBase64: attachment.dataBase64,
  }));
}

function buildParallelComparisonPrompt(input: {
  originalInput: string;
  results: Array<{
    provider: ProviderName;
    model: string;
    outputText: string;
  }>;
}) {
  return [
    "You are comparing parallel AI outputs for the same task.",
    "Write in Korean if the task or outputs are mostly Korean. Otherwise write in English.",
    "Summarize the results with these sections:",
    "1. Shared points",
    "2. Main differences by model",
    "3. Distinct strengths or risks",
    "4. When each answer is the better choice",
    "Be specific and mention the model names exactly as provided.",
    "",
    "[Original task]",
    input.originalInput,
    "",
    "[Parallel results]",
    ...input.results.map((result, index) =>
      [
        `${index + 1}. ${result.provider}/${result.model}`,
        result.outputText.slice(0, 4000),
      ].join("\n"),
    ),
  ].join("\n");
}

export type ParallelComparisonSummaryResult = {
  summary: string;
  provider: ProviderName;
  model: string;
  generatedAt: string;
  comparedResultIds: string[];
};

/**
 * Builds a stable cache key for a comparison from the result IDs it covers.
 * Order-independent so the same set of results always maps to the same key.
 */
export function buildParallelComparisonSignature(resultIds: string[]) {
  return Array.from(new Set(resultIds.filter(Boolean)))
    .sort()
    .join("|");
}

/**
 * Returns a previously saved comparison for this exact set of results, or null
 * if none has been generated yet. Used so re-opening the workbench loads the
 * stored summary instead of re-running the comparison model every time.
 */
export async function findSavedParallelComparison(input: {
  userId: string;
  sessionId: string;
  resultIds?: string[];
}): Promise<ParallelComparisonSummaryResult | null> {
  const signature = buildParallelComparisonSignature(input.resultIds ?? []);
  if (!signature) {
    return null;
  }

  const session = await prisma.workbenchSession.findFirst({
    where: { id: input.sessionId, userId: input.userId },
    select: { id: true },
  });
  if (!session) {
    return null;
  }

  const saved = await prisma.parallelComparison.findUnique({
    where: { sessionId_signature: { sessionId: session.id, signature } },
  });
  if (!saved) {
    return null;
  }

  return {
    summary: saved.summary,
    provider: saved.provider as ProviderName,
    model: saved.model,
    generatedAt: saved.createdAt.toISOString(),
    comparedResultIds: saved.comparedResultIds,
  };
}

export async function generateParallelComparisonSummary(input: {
  userId: string;
  sessionId: string;
  resultIds?: string[];
}): Promise<ParallelComparisonSummaryResult> {
  const { provider, model } = getParallelComparisonSummaryTarget();
  const session = await prisma.workbenchSession.findFirst({
    where: {
      id: input.sessionId,
      userId: input.userId,
    },
    select: {
      id: true,
      originalInput: true,
    },
  });

  if (!session) {
    throw new Error("Session was not found for comparison.");
  }

  await ensureResultExecutionRunIdColumn();
  const results = await prisma.result.findMany({
    where: {
      sessionId: session.id,
      ...(input.resultIds?.length ? { id: { in: input.resultIds } } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      provider: true,
      model: true,
      outputText: true,
      status: true,
    },
  });

  const comparableResults = results.filter(
    (result) =>
      result.status === "completed" &&
      typeof result.outputText === "string" &&
      result.outputText.trim().length > 0 &&
      // Image results are binary data URLs; they cannot be text-compared.
      !isImageDataUrl(result.outputText),
  );

  if (comparableResults.length < 2) {
    throw new Error("At least two completed results are required for comparison.");
  }

  const providerResult = await callProvider(input.userId, {
    provider,
    model,
    prompt: buildParallelComparisonPrompt({
      originalInput: session.originalInput,
      results: comparableResults.map((result) => ({
        provider: result.provider as ProviderName,
        model: result.model,
        outputText: result.outputText ?? "",
      })),
    }),
    concurrencyOwner: {
      ownerKind: "parallel_comparison",
      ownerId: `compare:${input.sessionId}:${Date.now()}`,
    },
  });

  await prisma.aiRequest.create({
    data: {
      userId: input.userId,
      conversationId: session.id,
      provider: providerResult.provider,
      model: providerResult.model,
      requestType: "summarize",
      status: providerResult.status,
      inputTokens: providerResult.usage?.promptTokens ?? null,
      outputTokens: providerResult.usage?.completionTokens ?? null,
      estimatedCostUsd: providerResult.estimatedCost ?? null,
      latencyMs: providerResult.latencyMs,
      errorCode:
        providerResult.status === "failed"
          ? "PARALLEL_COMPARISON_FAILED"
          : null,
      errorMessage: providerResult.errorMessage || null,
    },
  });

  if (
    providerResult.status === "failed" ||
    !providerResult.outputText.trim()
  ) {
    throw new Error(
      providerResult.errorMessage || "Could not generate comparison summary.",
    );
  }

  const comparedResultIds = comparableResults.map((result) => result.id);
  const signature = buildParallelComparisonSignature(comparedResultIds);

  // Persist so the next time this exact set of results is viewed we can load
  // the saved summary instead of re-running the comparison model.
  const saved = await prisma.parallelComparison.upsert({
    where: { sessionId_signature: { sessionId: session.id, signature } },
    create: {
      sessionId: session.id,
      signature,
      summary: providerResult.outputText,
      provider: providerResult.provider,
      model: providerResult.model,
      comparedResultIds,
    },
    update: {
      summary: providerResult.outputText,
      provider: providerResult.provider,
      model: providerResult.model,
      comparedResultIds,
    },
  });

  return {
    summary: saved.summary,
    provider: saved.provider as ProviderName,
    model: saved.model,
    generatedAt: saved.createdAt.toISOString(),
    comparedResultIds: saved.comparedResultIds,
  };
}

export async function upsertWorkbenchSession(
  userId: string,
  input: SessionInput,
) {
  const projectId = await resolveProjectId(userId, input.projectId);
  const encryptedOriginalInput = encryptTextContent(input.originalInput);
  const [supportsWorkflowControl, supportsWorkflowTemplateSteps] =
    await Promise.all([
      ensureWorkflowControlJsonColumn(),
      ensureWorkflowTemplateStepsJsonColumn(),
    ]);
  const workflowControlJson = input.workflowControl
    ? JSON.stringify(input.workflowControl)
    : null;
  const shouldWriteWorkflowTemplateSteps =
    input.workflowTemplateSteps !== undefined;
  const workflowTemplateStepsJson = shouldWriteWorkflowTemplateSteps
    ? serializeWorkflowTemplateSteps(input.workflowTemplateSteps)
    : null;

  if (input.sessionId) {
    const existing = await prisma.workbenchSession.findFirst({
      where: { id: input.sessionId, userId },
      select: {
        id: true,
        projectId: true,
        outputLanguage: true,
      },
    });

    if (existing) {
      return prisma.workbenchSession.update({
        where: { id: existing.id },
        data: {
          projectId:
            input.projectId === undefined ? existing.projectId : projectId,
          title: input.title?.trim() || defaultTitle(input.originalInput),
          originalInput: input.originalInput,
          originalInputCiphertext: encryptedOriginalInput.ciphertext,
          originalInputIv: encryptedOriginalInput.iv,
          originalInputTag: encryptedOriginalInput.tag,
          additionalInstruction: input.additionalInstruction || null,
          outputStyle: input.outputStyle || null,
          outputLanguage: input.outputLanguage || existing.outputLanguage || null,
          ...(supportsWorkflowControl ? { workflowControlJson } : {}),
          ...(supportsWorkflowTemplateSteps
            && shouldWriteWorkflowTemplateSteps
            ? { workflowTemplateStepsJson }
            : {}),
          mode: input.mode,
        },
      });
    }
  }

  return prisma.workbenchSession.create({
    data: {
      userId,
      projectId,
      title: input.title?.trim() || defaultTitle(input.originalInput),
      originalInput: input.originalInput,
      originalInputCiphertext: encryptedOriginalInput.ciphertext,
      originalInputIv: encryptedOriginalInput.iv,
      originalInputTag: encryptedOriginalInput.tag,
      additionalInstruction: input.additionalInstruction || null,
      outputStyle: input.outputStyle || null,
      outputLanguage: input.outputLanguage || null,
      ...(supportsWorkflowControl ? { workflowControlJson } : {}),
      ...(supportsWorkflowTemplateSteps && shouldWriteWorkflowTemplateSteps
        ? { workflowTemplateStepsJson }
        : {}),
      mode: input.mode,
    },
  });
}

export async function executeAndPersistResult(input: ExecutePersistInput) {
  await ensureResultExecutionRunIdColumn();
  const supportsExecutionOrder = await ensureResultExecutionOrderColumn();
  if (
    input.executionRunId &&
    input.executionOrder &&
    !supportsExecutionOrder
  ) {
    throw new Error(
      "Sequential run idempotency index is not available. Retry after database migration completes.",
    );
  }
  let initial: PersistedWorkbenchResult;
  try {
    const resultCreateData: Prisma.ResultCreateArgs["data"] = {
      session: { connect: { id: input.sessionId } },
      executionOrder: input.executionOrder ?? null,
      ...(input.executionRunId
        ? { executionRun: { connect: { id: input.executionRunId } } }
        : {}),
      ...(input.workflowStepId
        ? { workflowStep: { connect: { id: input.workflowStepId } } }
        : input.workflowStepData
          ? {
              workflowStep: {
                create: {
                  session: { connect: { id: input.workflowStepData.sessionId } },
                  orderIndex: input.workflowStepData.orderIndex,
                  actionType: input.workflowStepData.actionType,
                  targetProvider: input.workflowStepData.targetProvider,
                  targetModel: input.workflowStepData.targetModel,
                  sourceMode: input.workflowStepData.sourceMode,
                  sourceResultId: input.workflowStepData.sourceResultId ?? null,
                  instructionTemplate:
                    input.workflowStepData.instructionTemplate ?? null,
                },
              },
            }
          : {}),
      ...(input.parentResultId
        ? { parent: { connect: { id: input.parentResultId } } }
        : {}),
      branchKey: input.branchKey || null,
      provider: input.provider,
      model: input.model,
      promptSnapshot: input.prompt,
      outputText: null,
      status: "running",
    };

    initial = await prisma.result.create({
      include: {
        workflowStep: {
          select: { orderIndex: true, actionType: true },
        },
      },
      data: resultCreateData,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      input.executionRunId &&
      input.executionOrder
    ) {
      if (input.workflowStepId) {
        await prisma.workflowStep
          .delete({ where: { id: input.workflowStepId } })
          .catch(() => undefined);
      }

      const existing = await waitForExecutionStepResult({
        executionRunId: input.executionRunId,
        sessionId: input.sessionId,
        executionOrder: input.executionOrder,
      });
      if (existing) {
        return existing;
      }
    }

    throw error;
  }

  if (input.attachments?.length) {
    await prisma.resultAttachment.createMany({
      data: input.attachments.map((attachment) => ({
        resultId: initial.id,
        attachmentId: attachment.id,
      })),
    });
  }

  await input.onStarted?.(initial);

  const providerResult = await callProvider(input.userId, {
    provider: input.provider,
    model: input.model,
    prompt: input.prompt,
    attachments: toProviderAttachments(input.attachments),
    allowFallback: input.allowFallback ?? false,
    abortSignal: input.abortSignal,
    concurrencyOwner: {
      ownerKind: "result",
      ownerId: initial.id,
    },
  });
  const wasCanceled = input.abortSignal?.aborted ?? false;
  const persistedStatus = wasCanceled ? "canceled" : providerResult.status;
  const persistedErrorMessage = wasCanceled
    ? input.canceledErrorMessage || STEP_STOP_MESSAGE
    : providerResult.errorMessage || null;
  const encryptedOutput =
    providerResult.outputText && providerResult.outputText.trim()
      ? encryptTextContent(providerResult.outputText)
      : null;

  const errorCode =
    persistedStatus === "canceled"
      ? "RUN_STEP_CANCELED"
      : providerResult.status === "failed"
      ? providerResult.errorMessage?.includes("not configured")
        ? "MISSING_API_KEY"
        : "PROVIDER_REQUEST_FAILED"
      : null;

  const [updated] = await prisma.$transaction([
    prisma.result.update({
      where: { id: initial.id },
      include: {
        workflowStep: {
          select: { orderIndex: true, actionType: true },
        },
      },
      data: {
        outputText: providerResult.outputText,
        outputTextCiphertext: encryptedOutput?.ciphertext ?? null,
        outputTextIv: encryptedOutput?.iv ?? null,
        outputTextTag: encryptedOutput?.tag ?? null,
        provider: providerResult.provider,
        model: providerResult.model,
        rawResponse: providerResult.rawResponse
          ? JSON.stringify(providerResult.rawResponse)
          : null,
        status: persistedStatus,
        errorMessage: persistedErrorMessage,
        tokenUsagePrompt: providerResult.usage?.promptTokens ?? null,
        tokenUsageCompletion: providerResult.usage?.completionTokens ?? null,
        estimatedCost: providerResult.estimatedCost ?? null,
        costIsEstimated: providerResult.costIsEstimated ?? false,
        latencyMs: providerResult.latencyMs,
      },
    }),
    prisma.aiRequest.create({
      data: {
        userId: input.userId,
        conversationId: input.sessionId,
        messageId: initial.id,
        provider: providerResult.provider,
        model: providerResult.model,
        requestType: input.requestType,
        status: persistedStatus,
        inputTokens: providerResult.usage?.promptTokens ?? null,
        outputTokens: providerResult.usage?.completionTokens ?? null,
        estimatedCostUsd: providerResult.estimatedCost ?? null,
        latencyMs: providerResult.latencyMs,
        errorCode,
        errorMessage: persistedErrorMessage,
      },
    }),
  ]);

  return updated;
}

export async function executeParallelRun(input: {
  userId: string;
  session: SessionInput;
  targets: TargetModelInput[];
}) {
  const session = await upsertWorkbenchSession(input.userId, {
    ...input.session,
    workflowControl: input.session.workflowControl,
    mode: "parallel",
  });
  const projectContext = await buildProjectPromptContext({
    userId: input.userId,
    projectId: session.projectId,
    excludeSessionId: session.id,
  });
  const attachmentRecords = await claimSessionAttachments({
    userId: input.userId,
    sessionId: session.id,
    attachmentIds: input.session.attachmentIds,
  });
  const runtimeAttachments = await hydrateRuntimeAttachments(attachmentRecords);

  const results = await Promise.all(
    input.targets.map((target, index) =>
      executeAndPersistResult({
        userId: input.userId,
        sessionId: session.id,
        executionOrder: index + 1,
        workflowStepData: {
          sessionId: session.id,
          orderIndex: index + 1,
          actionType: "generate",
          targetProvider: target.provider,
          targetModel: target.model,
          sourceMode: "original",
          instructionTemplate: "Initial parallel comparison run",
        },
        branchKey: `parallel-${Date.now()}`,
        provider: target.provider,
        model: target.model,
        requestType: "generate",
        attachments: runtimeAttachments,
        allowFallback: shouldAllowConfiguredProviderFallback("parallel"),
        prompt: composeParallelTargetPrompt({
          provider: target.provider,
          model: target.model,
          originalInput: input.session.originalInput,
          additionalInstruction: input.session.additionalInstruction,
          projectContext,
          outputStyle: input.session.outputStyle,
          outputLanguage: input.session.outputLanguage,
        }),
      }),
    ),
  );

  await prisma.workbenchSession.update({
    where: { id: session.id },
    data: { updatedAt: new Date() },
  });

  return { session, results };
}

export async function executeParallelRunIncremental(input: {
  userId: string;
  executionRunId?: string | null;
  session: SessionInput;
  targets: TargetModelInput[];
  callbacks?: IncrementalRunCallbacks;
}) {
  if (await input.callbacks?.shouldStop?.()) {
    throw createAbortError(RUN_STOP_MESSAGE);
  }

  const session = await upsertWorkbenchSession(input.userId, {
    ...input.session,
    workflowControl: input.session.workflowControl,
    mode: "parallel",
  });
  await input.callbacks?.onSession?.(session);

  if (await input.callbacks?.shouldStop?.()) {
    throw createAbortError(RUN_STOP_MESSAGE);
  }

  const projectContext = await buildProjectPromptContext({
    userId: input.userId,
    projectId: session.projectId,
    excludeSessionId: session.id,
  });
  const attachmentRecords = await claimSessionAttachments({
    userId: input.userId,
    sessionId: session.id,
    attachmentIds: input.session.attachmentIds,
  });
  const runtimeAttachments = await hydrateRuntimeAttachments(attachmentRecords);
  const branchKey = `parallel-${Date.now()}`;

  // All parallel targets share one cancellation poller: shouldStop is
  // run-level, so per-target pollers only multiplied the same database query
  // by the number of targets.
  const abortController = createPolledAbortController({
    message: RUN_STOP_MESSAGE,
    shouldAbort: async () => Boolean(await input.callbacks?.shouldStop?.()),
  });

  let settledResults: PromiseSettledResult<
    Awaited<ReturnType<typeof executeAndPersistResult>>
  >[];
  try {
    settledResults = await Promise.allSettled(
      input.targets.map(async (target, index) => {
        if (await input.callbacks?.shouldStop?.()) {
          throw createAbortError(RUN_STOP_MESSAGE);
        }

        await input.callbacks?.onStepStart?.({
          index,
          title: `${target.provider} / ${target.model}`,
          subtitle: `Parallel run ${index + 1}`,
          detail: "Preparing the prompt and context.",
        });

        const result = await executeAndPersistResult({
          userId: input.userId,
          sessionId: session.id,
          executionRunId: input.executionRunId ?? null,
          executionOrder: index + 1,
          workflowStepData: {
            sessionId: session.id,
            orderIndex: index + 1,
            actionType: "generate",
            targetProvider: target.provider,
            targetModel: target.model,
            sourceMode: "original",
            instructionTemplate: "Initial parallel comparison run",
          },
          branchKey,
          provider: target.provider,
          model: target.model,
          requestType: "generate",
          attachments: runtimeAttachments,
          allowFallback: shouldAllowConfiguredProviderFallback("parallel"),
          abortSignal: abortController.signal,
          canceledErrorMessage: RUN_STOP_MESSAGE,
          onStarted: async (startedResult) => {
            await input.callbacks?.onResultStart?.({
              index,
              result: startedResult,
            });
          },
          prompt: composeParallelTargetPrompt({
            provider: target.provider,
            model: target.model,
            originalInput: input.session.originalInput,
            additionalInstruction: input.session.additionalInstruction,
            projectContext,
            outputStyle: input.session.outputStyle,
            outputLanguage: input.session.outputLanguage,
          }),
        });

        await input.callbacks?.onResult?.({ index, result });
        return result;
      }),
    );
  } finally {
    abortController.cleanup();
  }
  const results = settledResults
    .filter(
      (item): item is PromiseFulfilledResult<
        Awaited<ReturnType<typeof executeAndPersistResult>>
      > => item.status === "fulfilled",
    )
    .map((item) => item.value);
  const rejectedResult = settledResults.find(
    (item): item is PromiseRejectedResult => item.status === "rejected",
  );

  if (rejectedResult) {
    throw rejectedResult.reason;
  }

  await prisma.workbenchSession.update({
    where: { id: session.id },
    data: { updatedAt: new Date() },
  });

  return { session, results };
}

export async function resolveSourceText(input: {
  userId: string;
  sessionId: string;
  originalInput?: string | null;
  sourceMode: SourceMode;
  sourceResultId?: string | null;
  previousResultText?: string | null;
}) {
  await ensureResultExecutionRunIdColumn();
  if (input.sourceMode === "previous") {
    return truncatePromptContext(
      stripImageDataUrlForText(input.previousResultText) || "",
      MAX_SOURCE_TEXT_CHARS,
      "Source result",
    );
  }

  if (input.sourceMode === "selected_result" && input.sourceResultId) {
    const result = await prisma.result.findFirst({
      where: {
        id: input.sourceResultId,
        sessionId: input.sessionId,
        session: { userId: input.userId },
      },
    });
    return truncatePromptContext(
      stripImageDataUrlForText(result?.outputText) || result?.errorMessage || "",
      MAX_SOURCE_TEXT_CHARS,
      "Source result",
    );
  }

  if (input.sourceMode === "all_results") {
    const results = await prisma.result.findMany({
      where: { sessionId: input.sessionId, session: { userId: input.userId } },
      orderBy: { createdAt: "asc" },
    });
    const completedResults = results.filter(
      (result) => result.status === "completed" && result.outputText?.trim(),
    );

    if (!completedResults.length && input.originalInput?.trim()) {
      return truncatePromptContext(
        [
          "No completed prior results are available yet.",
          "Continue from the original task instead of treating provider failure messages as source material.",
          "",
          "[Original task]",
          input.originalInput,
        ].join("\n"),
        MAX_SOURCE_TEXT_CHARS,
        "Combined source results",
      );
    }

    return truncatePromptContext(
      (completedResults.length ? completedResults : results)
        .map((result, index) =>
        [
          `Result ${index + 1} (${result.provider}/${result.model})`,
          stripImageDataUrlForText(result.outputText) ||
            (result.status === "failed"
              ? `This result failed and produced no usable output: ${result.errorMessage || "unknown error"}`
              : result.errorMessage || ""),
        ].join("\n"),
        )
        .join("\n\n"),
      MAX_SOURCE_TEXT_CHARS,
      "Combined source results",
    );
  }

  return "";
}

export async function executeSequentialRun(input: {
  userId: string;
  executionRunId?: string | null;
  session: SessionInput;
  steps: WorkflowStepInput[];
  workflowControl?: WorkflowControlInput;
  callbacks?: IncrementalRunCallbacks;
}) {
  const session = await upsertWorkbenchSession(input.userId, {
    ...input.session,
    workflowControl: input.workflowControl,
    workflowTemplateSteps: input.steps,
    mode: "sequential",
  });
  const projectContext = await buildProjectPromptContext({
    userId: input.userId,
    projectId: session.projectId,
    excludeSessionId: session.id,
  });
  const attachmentRecords = await claimSessionAttachments({
    userId: input.userId,
    sessionId: session.id,
    attachmentIds: input.session.attachmentIds,
  });
  const runtimeAttachments = await hydrateRuntimeAttachments(attachmentRecords);
  const stopCondition = input.workflowControl?.stopCondition;
  if (
    stopCondition?.enabled &&
    (stopCondition.checkStepOrder < 1 ||
      stopCondition.checkStepOrder > input.steps.length)
  ) {
    throw new Error("Stop-condition step is out of bounds.");
  }
  const expandedSteps = buildExpandedSteps(input.steps, input.workflowControl);
  let previousResultText: string | null = null;
  let previousResultId: string | null = null;
  const results = [];
  let completedResultCount = 0;
  let consecutiveRecoveryFailures = 0;
  let stoppedEarly = false;
  let stopReason: string | null = null;

  for (const expandedStep of expandedSteps) {
    const stepIndex = expandedStep.executionOrder - 1;
    const step = expandedStep.templateStep;
    const qualityThreshold =
      stopCondition?.enabled &&
      stopCondition.checkStepOrder === expandedStep.executionOrder;
    const monitorQuality = qualityThreshold ? stopCondition.qualityThreshold : null;
    const mergedInstruction = [
      step.instructionTemplate?.trim() || "",
      monitorQuality !== null ? getQualityDirective(monitorQuality) : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const existingResult = await waitForExecutionStepResult({
      executionRunId: input.executionRunId,
      sessionId: session.id,
      executionOrder: expandedStep.executionOrder,
      shouldStop: input.callbacks?.shouldStop,
      shouldStopStep: input.callbacks?.shouldStopStep,
    });

    if (existingResult) {
      if (existingResult.status === "running") {
        if (await input.callbacks?.shouldStop?.()) {
          stoppedEarly = true;
          stopReason = "canceled";
          break;
        }

        if (await input.callbacks?.shouldStopStep?.(stepIndex)) {
          await input.callbacks?.onStepSkipped?.({
            index: stepIndex,
            title: `${step.targetProvider} / ${step.targetModel}`,
            subtitle: `Step ${expandedStep.executionOrder}`,
            actionType: step.actionType,
            detail: STEP_STOP_MESSAGE,
          });
          continue;
        }

        await input.callbacks?.onResultStart?.({
          index: stepIndex,
          result: existingResult,
        });
        stoppedEarly = true;
        stopReason = EXISTING_STEP_STILL_RUNNING_REASON;
        break;
      }

      let effectiveOutput = existingResult.outputText || "";
      if (monitorQuality !== null) {
        const score = extractQualityScore(existingResult.outputText);
        const strippedOutput = stripQualityScoreLine(existingResult.outputText);
        if (
          existingResult.outputText &&
          strippedOutput !== existingResult.outputText
        ) {
          await updateResultOutputText(existingResult.id, strippedOutput);
          existingResult.outputText = strippedOutput || null;
          effectiveOutput = strippedOutput;
        }

        if (score !== null && score >= monitorQuality) {
          stoppedEarly = true;
          stopReason = `quality_score_${score}_gte_${monitorQuality}`;
        }
      }

      results.push(existingResult);
      await input.callbacks?.onResult?.({
        index: stepIndex,
        result: existingResult,
      });

      if (existingResult.status === "canceled") {
        if (await input.callbacks?.shouldStop?.()) {
          stoppedEarly = true;
          stopReason = "canceled";
          break;
        }

        continue;
      }

      if (existingResult.status === "failed") {
        consecutiveRecoveryFailures += 1;

        if (
          (completedResultCount === 0 &&
            consecutiveRecoveryFailures >= MAX_INITIAL_SEQUENTIAL_RECOVERY_FAILURES) ||
          consecutiveRecoveryFailures >= MAX_SEQUENTIAL_CONSECUTIVE_FAILURES
        ) {
          stoppedEarly = true;
          stopReason =
            completedResultCount === 0
              ? `step_${expandedStep.executionOrder}_failed_no_recovery`
              : `step_${expandedStep.executionOrder}_failed_limit`;
          break;
        }

        previousResultText =
          previousResultText ||
          buildFailedStepRecoverySource({
            originalInput: input.session.originalInput,
            stepNumber: expandedStep.executionOrder,
            provider: step.targetProvider,
            model: step.targetModel,
            errorMessage: existingResult.errorMessage,
          });
        continue;
      }

      previousResultText = effectiveOutput || existingResult.errorMessage || "";
      previousResultId = existingResult.id;
      if (existingResult.status === "completed") {
        completedResultCount += 1;
        consecutiveRecoveryFailures = 0;
      }

      if (stoppedEarly) {
        break;
      }

      continue;
    }

    const sourceText = await resolveSourceText({
      userId: input.userId,
      sessionId: session.id,
      originalInput: input.session.originalInput,
      sourceMode: step.sourceMode,
      sourceResultId: step.sourceResultId,
      previousResultText,
    });

    const result = await executeAndPersistResult({
      userId: input.userId,
      sessionId: session.id,
      executionRunId: input.executionRunId ?? null,
      executionOrder: expandedStep.executionOrder,
      workflowStepData: buildWorkflowStepPersistInput({
        sessionId: session.id,
        executionOrder: expandedStep.executionOrder,
        step,
      }),
      parentResultId:
        step.sourceMode === "previous" ? previousResultId : step.sourceResultId,
      branchKey: `chain-${session.id}`,
      provider: step.targetProvider,
      model: step.targetModel,
      requestType: step.actionType,
      attachments: runtimeAttachments,
      prompt: composePrompt({
        actionType: step.actionType,
        originalInput: input.session.originalInput,
        additionalInstruction: input.session.additionalInstruction,
        projectContext,
        outputStyle: input.session.outputStyle,
        outputLanguage: input.session.outputLanguage,
        sourceText,
        instructionTemplate: mergedInstruction || null,
      }),
    });

    let effectiveOutput = result.outputText || "";
    if (monitorQuality !== null) {
      const score = extractQualityScore(result.outputText);
      const strippedOutput = stripQualityScoreLine(result.outputText);
      if (result.outputText && strippedOutput !== result.outputText) {
        await updateResultOutputText(result.id, strippedOutput);
        result.outputText = strippedOutput || null;
        effectiveOutput = strippedOutput;
      }

      if (score !== null && score >= monitorQuality) {
        stoppedEarly = true;
        stopReason = `quality_score_${score}_gte_${monitorQuality}`;
      }
    }

    results.push(result);

    if (result.status === "running") {
      stoppedEarly = true;
      stopReason = EXISTING_STEP_STILL_RUNNING_REASON;
      break;
    }

    if (result.status === "failed") {
      consecutiveRecoveryFailures += 1;

      if (
        (completedResultCount === 0 &&
          consecutiveRecoveryFailures >= MAX_INITIAL_SEQUENTIAL_RECOVERY_FAILURES) ||
        consecutiveRecoveryFailures >= MAX_SEQUENTIAL_CONSECUTIVE_FAILURES
      ) {
        stoppedEarly = true;
        stopReason =
          completedResultCount === 0
            ? `step_${expandedStep.executionOrder}_failed_no_recovery`
            : `step_${expandedStep.executionOrder}_failed_limit`;
        break;
      }

      previousResultText =
        previousResultText ||
        buildFailedStepRecoverySource({
          originalInput: input.session.originalInput,
          stepNumber: expandedStep.executionOrder,
          provider: step.targetProvider,
          model: step.targetModel,
          errorMessage: result.errorMessage,
        });
      continue;
    }

    previousResultText = effectiveOutput || result.errorMessage || "";
    previousResultId = result.id;
    if (result.status === "completed") {
      completedResultCount += 1;
      consecutiveRecoveryFailures = 0;
    }

    if (stoppedEarly) {
      break;
    }
  }

  const updatedSession = await prisma.workbenchSession.update({
    where: { id: session.id },
    data: {
      updatedAt: new Date(),
      finalResultId: pickFinalResultId(results),
    },
  });

  return {
    session: updatedSession,
    results,
    executionSummary: {
      plannedTotal: expandedSteps.length,
      executedTotal: results.length,
      stoppedEarly,
      stopReason,
    },
  };
}

export async function executeSequentialRunIncremental(input: {
  userId: string;
  executionRunId?: string | null;
  session: SessionInput;
  steps: WorkflowStepInput[];
  workflowControl?: WorkflowControlInput;
  callbacks?: IncrementalRunCallbacks;
}) {
  const session = await upsertWorkbenchSession(input.userId, {
    ...input.session,
    workflowControl: input.workflowControl,
    workflowTemplateSteps: input.steps,
    mode: "sequential",
  });
  await input.callbacks?.onSession?.(session);

  const projectContext = await buildProjectPromptContext({
    userId: input.userId,
    projectId: session.projectId,
    excludeSessionId: session.id,
  });
  const attachmentRecords = await claimSessionAttachments({
    userId: input.userId,
    sessionId: session.id,
    attachmentIds: input.session.attachmentIds,
  });
  const runtimeAttachments = await hydrateRuntimeAttachments(attachmentRecords);
  const stopCondition = input.workflowControl?.stopCondition;
  if (
    stopCondition?.enabled &&
    (stopCondition.checkStepOrder < 1 ||
      stopCondition.checkStepOrder > input.steps.length)
  ) {
    throw new Error("Stop-condition step is out of bounds.");
  }
  const expandedSteps = buildExpandedSteps(input.steps, input.workflowControl);
  let previousResultText: string | null = null;
  let previousResultId: string | null = null;
  const results = [];
  let completedResultCount = 0;
  let consecutiveRecoveryFailures = 0;
  let stoppedEarly = false;
  let stopReason: string | null = null;

  for (const expandedStep of expandedSteps) {
    const stepIndex = expandedStep.executionOrder - 1;
    if (await input.callbacks?.shouldStop?.()) {
      stoppedEarly = true;
      stopReason = "canceled";
      break;
    }

    if (await input.callbacks?.shouldStopStep?.(stepIndex)) {
      const skippedStep = expandedStep.templateStep;
      await input.callbacks?.onStepSkipped?.({
        index: stepIndex,
        title: `${skippedStep.targetProvider} / ${skippedStep.targetModel}`,
        subtitle: `Step ${expandedStep.executionOrder}`,
        actionType: skippedStep.actionType,
        detail: STEP_STOP_MESSAGE,
      });
      continue;
    }

    const step = expandedStep.templateStep;
    const qualityThreshold =
      stopCondition?.enabled &&
      stopCondition.checkStepOrder === expandedStep.executionOrder;
    const monitorQuality = qualityThreshold ? stopCondition.qualityThreshold : null;
    const mergedInstruction = [
      step.instructionTemplate?.trim() || "",
      monitorQuality !== null ? getQualityDirective(monitorQuality) : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const existingResult = await waitForExecutionStepResult({
      executionRunId: input.executionRunId,
      sessionId: session.id,
      executionOrder: expandedStep.executionOrder,
      shouldStop: input.callbacks?.shouldStop,
      shouldStopStep: input.callbacks?.shouldStopStep,
    });

    if (existingResult) {
      if (existingResult.status === "running") {
        if (await input.callbacks?.shouldStop?.()) {
          stoppedEarly = true;
          stopReason = "canceled";
          break;
        }

        if (await input.callbacks?.shouldStopStep?.(stepIndex)) {
          await input.callbacks?.onStepSkipped?.({
            index: stepIndex,
            title: `${step.targetProvider} / ${step.targetModel}`,
            subtitle: `Step ${expandedStep.executionOrder}`,
            actionType: step.actionType,
            detail: STEP_STOP_MESSAGE,
          });
          continue;
        }

        await input.callbacks?.onResultStart?.({
          index: stepIndex,
          result: existingResult,
        });
        stoppedEarly = true;
        stopReason = EXISTING_STEP_STILL_RUNNING_REASON;
        break;
      }

      let effectiveOutput = existingResult.outputText || "";
      if (monitorQuality !== null) {
        const score = extractQualityScore(existingResult.outputText);
        const strippedOutput = stripQualityScoreLine(existingResult.outputText);
        if (
          existingResult.outputText &&
          strippedOutput !== existingResult.outputText
        ) {
          await updateResultOutputText(existingResult.id, strippedOutput);
          existingResult.outputText = strippedOutput || null;
          effectiveOutput = strippedOutput;
        }

        if (score !== null && score >= monitorQuality) {
          stoppedEarly = true;
          stopReason = `quality_score_${score}_gte_${monitorQuality}`;
        }
      }

      results.push(existingResult);
      await input.callbacks?.onResult?.({
        index: stepIndex,
        result: existingResult,
      });

      if (existingResult.status === "canceled") {
        if (await input.callbacks?.shouldStop?.()) {
          stoppedEarly = true;
          stopReason = "canceled";
          break;
        }

        continue;
      }

      if (existingResult.status === "failed") {
        consecutiveRecoveryFailures += 1;

        if (
          (completedResultCount === 0 &&
            consecutiveRecoveryFailures >= MAX_INITIAL_SEQUENTIAL_RECOVERY_FAILURES) ||
          consecutiveRecoveryFailures >= MAX_SEQUENTIAL_CONSECUTIVE_FAILURES
        ) {
          stoppedEarly = true;
          stopReason =
            completedResultCount === 0
              ? `step_${expandedStep.executionOrder}_failed_no_recovery`
              : `step_${expandedStep.executionOrder}_failed_limit`;
          break;
        }

        previousResultText =
          previousResultText ||
          buildFailedStepRecoverySource({
            originalInput: input.session.originalInput,
            stepNumber: expandedStep.executionOrder,
            provider: step.targetProvider,
            model: step.targetModel,
            errorMessage: existingResult.errorMessage,
          });
        continue;
      }

      previousResultText = effectiveOutput || existingResult.errorMessage || "";
      previousResultId = existingResult.id;
      if (existingResult.status === "completed") {
        completedResultCount += 1;
        consecutiveRecoveryFailures = 0;
      }

      if (stoppedEarly) {
        break;
      }

      continue;
    }

    const sourceText = await resolveSourceText({
      userId: input.userId,
      sessionId: session.id,
      originalInput: input.session.originalInput,
      sourceMode: step.sourceMode,
      sourceResultId: step.sourceResultId,
      previousResultText,
    });

    await input.callbacks?.onStepStart?.({
      index: stepIndex,
      title: `${step.targetProvider} / ${step.targetModel}`,
      subtitle: `Step ${expandedStep.executionOrder}`,
      actionType: step.actionType,
      detail: "Preparing the prompt and context.",
    });

    const abortController = createPolledAbortController({
      message: STEP_STOP_MESSAGE,
      shouldAbort: async () =>
        Boolean(
          (await input.callbacks?.shouldStop?.()) ||
            (await input.callbacks?.shouldStopStep?.(stepIndex)),
        ),
    });

    const lastUsableResultText: string | null = previousResultText;
    const lastUsableResultId: string | null = previousResultId;
    let result: Awaited<ReturnType<typeof executeAndPersistResult>>;
    try {
      result = await executeAndPersistResult({
        userId: input.userId,
        sessionId: session.id,
        executionRunId: input.executionRunId ?? null,
        executionOrder: expandedStep.executionOrder,
        workflowStepData: buildWorkflowStepPersistInput({
          sessionId: session.id,
          executionOrder: expandedStep.executionOrder,
          step,
        }),
        parentResultId:
          step.sourceMode === "previous" ? previousResultId : step.sourceResultId,
        branchKey: `chain-${session.id}`,
        provider: step.targetProvider,
        model: step.targetModel,
        requestType: step.actionType,
        attachments: runtimeAttachments,
        abortSignal: abortController.signal,
        canceledErrorMessage: STEP_STOP_MESSAGE,
        onStarted: async (startedResult) => {
          await input.callbacks?.onResultStart?.({
            index: stepIndex,
            result: startedResult,
          });
        },
        prompt: composePrompt({
          actionType: step.actionType,
          originalInput: input.session.originalInput,
          additionalInstruction: input.session.additionalInstruction,
          projectContext,
          outputStyle: input.session.outputStyle,
          outputLanguage: input.session.outputLanguage,
          sourceText,
          instructionTemplate: mergedInstruction || null,
        }),
      });
    } finally {
      abortController.cleanup();
    }

    let effectiveOutput = result.outputText || "";
    if (monitorQuality !== null) {
      const score = extractQualityScore(result.outputText);
      const strippedOutput = stripQualityScoreLine(result.outputText);
      if (result.outputText && strippedOutput !== result.outputText) {
        await updateResultOutputText(result.id, strippedOutput);
        result.outputText = strippedOutput || null;
        effectiveOutput = strippedOutput;
      }

      if (score !== null && score >= monitorQuality) {
        stoppedEarly = true;
        stopReason = `quality_score_${score}_gte_${monitorQuality}`;
      }
    }

    results.push(result);
    await input.callbacks?.onResult?.({
      index: stepIndex,
      result,
    });

    if (result.status === "running") {
      stoppedEarly = true;
      stopReason = EXISTING_STEP_STILL_RUNNING_REASON;
      break;
    }

    if (result.status === "canceled") {
      if (await input.callbacks?.shouldStop?.()) {
        stoppedEarly = true;
        stopReason = "canceled";
        break;
      }

      previousResultText = lastUsableResultText;
      previousResultId = lastUsableResultId;
      continue;
    }

    if (result.status === "failed") {
      consecutiveRecoveryFailures += 1;

      if (
        (completedResultCount === 0 &&
          consecutiveRecoveryFailures >= MAX_INITIAL_SEQUENTIAL_RECOVERY_FAILURES) ||
        consecutiveRecoveryFailures >= MAX_SEQUENTIAL_CONSECUTIVE_FAILURES
      ) {
        stoppedEarly = true;
        stopReason =
          completedResultCount === 0
            ? `step_${expandedStep.executionOrder}_failed_no_recovery`
            : `step_${expandedStep.executionOrder}_failed_limit`;
        break;
      }

      previousResultText =
        lastUsableResultText ||
        buildFailedStepRecoverySource({
          originalInput: input.session.originalInput,
          stepNumber: expandedStep.executionOrder,
          provider: step.targetProvider,
          model: step.targetModel,
          errorMessage: result.errorMessage,
        });
      previousResultId = lastUsableResultId;
      continue;
    }

    previousResultText = effectiveOutput || result.errorMessage || "";
    previousResultId = result.id;
    if (result.status === "completed") {
      completedResultCount += 1;
      consecutiveRecoveryFailures = 0;
    }

    if (await input.callbacks?.shouldStop?.()) {
      stoppedEarly = true;
      stopReason = "canceled";
      break;
    }

    if (stoppedEarly) {
      break;
    }
  }

  const updatedSession = await prisma.workbenchSession.update({
    where: { id: session.id },
    data: {
      updatedAt: new Date(),
      finalResultId: pickFinalResultId(results),
    },
  });

  return {
    session: updatedSession,
    results,
    executionSummary: {
      plannedTotal: expandedSteps.length,
      executedTotal: results.length,
      stoppedEarly,
      stopReason,
    },
  };
}

export async function executeBranchRun(input: {
  userId: string;
  parentResultId: string;
  actionType: ActionType;
  instruction: string;
  outputLanguage?: string | null;
  targets: TargetModelInput[];
}) {
  await ensureResultExecutionRunIdColumn();
  const parent = await prisma.result.findFirst({
    where: { id: input.parentResultId, session: { userId: input.userId } },
    include: { session: true },
  });

  if (!parent) {
    throw new Error("Result was not found for this account.");
  }

  const branchKey = `${input.actionType}-${Date.now()}`;
  const projectContext = await buildProjectPromptContext({
    userId: input.userId,
    projectId: parent.session.projectId,
    excludeSessionId: parent.sessionId,
  });
  const runtimeAttachments = await getAllSessionRuntimeAttachments({
    userId: input.userId,
    sessionId: parent.sessionId,
  });
  const results = await Promise.all(
    input.targets.map((target) =>
      executeAndPersistResult({
        userId: input.userId,
        sessionId: parent.sessionId,
        parentResultId: parent.id,
        branchKey,
        provider: target.provider,
        model: target.model,
        requestType: input.actionType,
        attachments: runtimeAttachments,
        prompt: composePrompt({
          actionType: input.actionType,
          originalInput: parent.session.originalInput,
          additionalInstruction: parent.session.additionalInstruction,
          projectContext,
          outputStyle: parent.session.outputStyle,
          outputLanguage: input.outputLanguage,
          sourceText: parent.outputText || parent.errorMessage || "",
          instructionTemplate: input.instruction,
        }),
      }),
    ),
  );

  await prisma.workbenchSession.update({
    where: { id: parent.sessionId },
    data: { updatedAt: new Date() },
  });

  return { sessionId: parent.sessionId, results };
}
