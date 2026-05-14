import "server-only";

import { prisma } from "@/lib/prisma";
import {
  claimSessionAttachments,
  getAllSessionRuntimeAttachments,
  hydrateRuntimeAttachments,
  type RuntimeAttachment,
} from "@/lib/attachments";
import { composePrompt } from "@/lib/ai/prompt";
import { callProvider } from "@/lib/ai/providers";
import { encryptTextContent } from "@/lib/secret-crypto";
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
  mode: string;
  attachmentIds?: string[];
};

type ExecutePersistInput = {
  userId: string;
  sessionId: string;
  workflowStepId?: string | null;
  parentResultId?: string | null;
  branchKey?: string | null;
  provider: ProviderName;
  model: string;
  requestType: ActionType | "rerun";
  prompt: string;
  attachments?: RuntimeAttachment[];
};

const MAX_TOTAL_SEQUENTIAL_STEPS = 50;
const MAX_PROJECT_CONTEXT_CHARS = 6000;
const MAX_SOURCE_TEXT_CHARS = 12000;

type ExpandedWorkflowStep = {
  executionOrder: number;
  templateStep: WorkflowStepInput;
};

type IncrementalProgressEvent = {
  index: number;
  title: string;
  subtitle: string;
  detail?: string;
};

type IncrementalRunCallbacks = {
  onSession?: (session: Awaited<ReturnType<typeof upsertWorkbenchSession>>) => void | Promise<void>;
  onStepStart?: (event: IncrementalProgressEvent) => void | Promise<void>;
  onResult?: (event: {
    index: number;
    result: Awaited<ReturnType<typeof executeAndPersistResult>>;
  }) => void | Promise<void>;
};

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
  if (!steps.length) {
    throw new Error("At least one sequential step is required.");
  }

  const repeat = workflowControl?.repeat;
  const expanded: WorkflowStepInput[] = [];

  if (repeat?.enabled) {
    const startIndex = repeat.startStepOrder - 1;
    const endIndex = repeat.endStepOrder - 1;

    if (startIndex < 0 || endIndex < 0 || startIndex >= steps.length || endIndex >= steps.length) {
      throw new Error("Repeat range is out of step bounds.");
    }

    if (startIndex > endIndex) {
      throw new Error("Repeat start step must be before or equal to end step.");
    }

    expanded.push(...steps.slice(0, startIndex));

    const repeatedBlock = steps.slice(startIndex, endIndex + 1);
    for (let i = 0; i < repeat.repeatCount; i += 1) {
      expanded.push(...repeatedBlock);
    }

    expanded.push(...steps.slice(endIndex + 1));
  } else {
    expanded.push(...steps);
  }

  if (expanded.length > MAX_TOTAL_SEQUENTIAL_STEPS) {
    throw new Error(`Total sequential executions cannot exceed ${MAX_TOTAL_SEQUENTIAL_STEPS}.`);
  }

  return expanded.map((step, index): ExpandedWorkflowStep => ({
    executionOrder: index + 1,
    templateStep: step,
  }));
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

export async function updateResultOutputText(resultId: string, outputText: string) {
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

export async function generateParallelComparisonSummary(input: {
  userId: string;
  sessionId: string;
  resultIds?: string[];
}) {
  const provider: ProviderName = "openai";
  const model = "gpt-5.4";
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
      result.outputText.trim().length > 0,
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

  return {
    summary: providerResult.outputText,
    provider: providerResult.provider,
    model: providerResult.model,
    generatedAt: new Date().toISOString(),
    comparedResultIds: comparableResults.map((result) => result.id),
  };
}

export async function upsertWorkbenchSession(
  userId: string,
  input: SessionInput,
) {
  const projectId = await resolveProjectId(userId, input.projectId);
  const encryptedOriginalInput = encryptTextContent(input.originalInput);

  if (input.sessionId) {
    const existing = await prisma.workbenchSession.findFirst({
      where: { id: input.sessionId, userId },
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
      mode: input.mode,
    },
  });
}

export async function executeAndPersistResult(input: ExecutePersistInput) {
  const initial = await prisma.result.create({
    data: {
      sessionId: input.sessionId,
      workflowStepId: input.workflowStepId || null,
      parentResultId: input.parentResultId || null,
      branchKey: input.branchKey || null,
      provider: input.provider,
      model: input.model,
      promptSnapshot: input.prompt,
      outputText: null,
      status: "running",
    },
  });

  if (input.attachments?.length) {
    await prisma.resultAttachment.createMany({
      data: input.attachments.map((attachment) => ({
        resultId: initial.id,
        attachmentId: attachment.id,
      })),
    });
  }

  const providerResult = await callProvider(input.userId, {
    provider: input.provider,
    model: input.model,
    prompt: input.prompt,
    attachments: toProviderAttachments(input.attachments),
  });
  const encryptedOutput =
    providerResult.outputText && providerResult.outputText.trim()
      ? encryptTextContent(providerResult.outputText)
      : null;

  const errorCode =
    providerResult.status === "failed"
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
        status: providerResult.status,
        errorMessage: providerResult.errorMessage || null,
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
        status: providerResult.status,
        inputTokens: providerResult.usage?.promptTokens ?? null,
        outputTokens: providerResult.usage?.completionTokens ?? null,
        estimatedCostUsd: providerResult.estimatedCost ?? null,
        latencyMs: providerResult.latencyMs,
        errorCode,
        errorMessage: providerResult.errorMessage || null,
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

  const stepRecords = await Promise.all(
    input.targets.map((target, index) =>
      prisma.workflowStep.create({
        data: {
          sessionId: session.id,
          orderIndex: index + 1,
          actionType: "generate",
          targetProvider: target.provider,
          targetModel: target.model,
          sourceMode: "original",
          instructionTemplate: "Initial parallel comparison run",
        },
      }),
    ),
  );

  const results = await Promise.all(
    input.targets.map((target, index) =>
      executeAndPersistResult({
        userId: input.userId,
        sessionId: session.id,
        workflowStepId: stepRecords[index].id,
        branchKey: `parallel-${Date.now()}`,
        provider: target.provider,
        model: target.model,
        requestType: "generate",
        attachments: runtimeAttachments,
        prompt: composePrompt({
          actionType: "generate",
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
  session: SessionInput;
  targets: TargetModelInput[];
  callbacks?: IncrementalRunCallbacks;
}) {
  const session = await upsertWorkbenchSession(input.userId, {
    ...input.session,
    mode: "parallel",
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
  const branchKey = `parallel-${Date.now()}`;

  const stepRecords = await Promise.all(
    input.targets.map((target, index) =>
      prisma.workflowStep.create({
        data: {
          sessionId: session.id,
          orderIndex: index + 1,
          actionType: "generate",
          targetProvider: target.provider,
          targetModel: target.model,
          sourceMode: "original",
          instructionTemplate: "Initial parallel comparison run",
        },
      }),
    ),
  );

  const results = await Promise.all(
    input.targets.map(async (target, index) => {
      await input.callbacks?.onStepStart?.({
        index,
        title: `${target.provider} / ${target.model}`,
        subtitle: `Parallel run ${index + 1}`,
        detail: "Preparing the prompt and context.",
      });

      const result = await executeAndPersistResult({
        userId: input.userId,
        sessionId: session.id,
        workflowStepId: stepRecords[index].id,
        branchKey,
        provider: target.provider,
        model: target.model,
        requestType: "generate",
        attachments: runtimeAttachments,
        prompt: composePrompt({
          actionType: "generate",
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

  await prisma.workbenchSession.update({
    where: { id: session.id },
    data: { updatedAt: new Date() },
  });

  return { session, results };
}

export async function resolveSourceText(input: {
  userId: string;
  sessionId: string;
  sourceMode: SourceMode;
  sourceResultId?: string | null;
  previousResultText?: string | null;
}) {
  if (input.sourceMode === "previous") {
    return truncatePromptContext(
      input.previousResultText || "",
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
      result?.outputText || result?.errorMessage || "",
      MAX_SOURCE_TEXT_CHARS,
      "Source result",
    );
  }

  if (input.sourceMode === "all_results") {
    const results = await prisma.result.findMany({
      where: { sessionId: input.sessionId, session: { userId: input.userId } },
      orderBy: { createdAt: "asc" },
    });

    return truncatePromptContext(
      results
        .map((result, index) =>
        [
          `Result ${index + 1} (${result.provider}/${result.model})`,
          result.outputText || result.errorMessage || "",
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
  session: SessionInput;
  steps: WorkflowStepInput[];
  workflowControl?: WorkflowControlInput;
}) {
  const session = await upsertWorkbenchSession(input.userId, {
    ...input.session,
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
  let stoppedEarly = false;
  let stopReason: string | null = null;

  for (const expandedStep of expandedSteps) {
    const step = expandedStep.templateStep;
    const qualityThreshold =
      stopCondition?.enabled &&
      stopCondition.checkStepOrder === step.orderIndex;
    const monitorQuality = qualityThreshold ? stopCondition.qualityThreshold : null;
    const mergedInstruction = [
      step.instructionTemplate?.trim() || "",
      monitorQuality !== null ? getQualityDirective(monitorQuality) : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const stepRecord = await prisma.workflowStep.create({
      data: {
        sessionId: session.id,
        orderIndex: expandedStep.executionOrder,
        actionType: step.actionType,
        targetProvider: step.targetProvider,
        targetModel: step.targetModel,
        sourceMode: step.sourceMode,
        sourceResultId: step.sourceResultId || null,
        instructionTemplate: step.instructionTemplate || null,
      },
    });

    const sourceText = await resolveSourceText({
      userId: input.userId,
      sessionId: session.id,
      sourceMode: step.sourceMode,
      sourceResultId: step.sourceResultId,
      previousResultText,
    });

    const result = await executeAndPersistResult({
      userId: input.userId,
      sessionId: session.id,
      workflowStepId: stepRecord.id,
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

    previousResultText = effectiveOutput || result.errorMessage || "";
    previousResultId = result.id;
    results.push(result);

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
  session: SessionInput;
  steps: WorkflowStepInput[];
  workflowControl?: WorkflowControlInput;
  callbacks?: IncrementalRunCallbacks;
}) {
  const session = await upsertWorkbenchSession(input.userId, {
    ...input.session,
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
  let stoppedEarly = false;
  let stopReason: string | null = null;

  for (const expandedStep of expandedSteps) {
    const step = expandedStep.templateStep;
    const qualityThreshold =
      stopCondition?.enabled &&
      stopCondition.checkStepOrder === step.orderIndex;
    const monitorQuality = qualityThreshold ? stopCondition.qualityThreshold : null;
    const mergedInstruction = [
      step.instructionTemplate?.trim() || "",
      monitorQuality !== null ? getQualityDirective(monitorQuality) : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const stepRecord = await prisma.workflowStep.create({
      data: {
        sessionId: session.id,
        orderIndex: expandedStep.executionOrder,
        actionType: step.actionType,
        targetProvider: step.targetProvider,
        targetModel: step.targetModel,
        sourceMode: step.sourceMode,
        sourceResultId: step.sourceResultId || null,
        instructionTemplate: step.instructionTemplate || null,
      },
    });

    const sourceText = await resolveSourceText({
      userId: input.userId,
      sessionId: session.id,
      sourceMode: step.sourceMode,
      sourceResultId: step.sourceResultId,
      previousResultText,
    });

    await input.callbacks?.onStepStart?.({
      index: expandedStep.executionOrder - 1,
      title: `${step.targetProvider} / ${step.targetModel}`,
      subtitle: `Step ${expandedStep.executionOrder}`,
      detail: "Preparing the prompt and context.",
    });

    const result = await executeAndPersistResult({
      userId: input.userId,
      sessionId: session.id,
      workflowStepId: stepRecord.id,
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

    previousResultText = effectiveOutput || result.errorMessage || "";
    previousResultId = result.id;
    results.push(result);
    await input.callbacks?.onResult?.({
      index: expandedStep.executionOrder - 1,
      result,
    });

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
