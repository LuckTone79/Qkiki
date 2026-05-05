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

type ExpandedWorkflowStep = {
  executionOrder: number;
  templateStep: WorkflowStepInput;
};

function defaultTitle(input: string) {
  const compact = input.replace(/\s+/g, " ").trim();
  return compact.length > 70 ? `${compact.slice(0, 67)}...` : compact;
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

async function buildProjectPromptContext(input: {
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

  return parts.join("\n\n");
}

function buildExpandedSteps(
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

function extractQualityScore(text: string | null | undefined) {
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

function stripQualityScoreLine(text: string | null | undefined) {
  if (!text) {
    return "";
  }

  return text
    .split("\n")
    .filter((line) => !/QUALITY_SCORE\s*[:=]\s*\d{1,3}/i.test(line))
    .join("\n")
    .trim();
}

async function updateResultOutputText(resultId: string, outputText: string) {
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
      data: {
        outputText: providerResult.outputText,
        outputTextCiphertext: encryptedOutput?.ciphertext ?? null,
        outputTextIv: encryptedOutput?.iv ?? null,
        outputTextTag: encryptedOutput?.tag ?? null,
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
        provider: input.provider,
        model: input.model,
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

async function resolveSourceText(input: {
  userId: string;
  sessionId: string;
  sourceMode: SourceMode;
  sourceResultId?: string | null;
  previousResultText?: string | null;
}) {
  if (input.sourceMode === "previous") {
    return input.previousResultText || "";
  }

  if (input.sourceMode === "selected_result" && input.sourceResultId) {
    const result = await prisma.result.findFirst({
      where: {
        id: input.sourceResultId,
        sessionId: input.sessionId,
        session: { userId: input.userId },
      },
    });
    return result?.outputText || result?.errorMessage || "";
  }

  if (input.sourceMode === "all_results") {
    const results = await prisma.result.findMany({
      where: { sessionId: input.sessionId, session: { userId: input.userId } },
      orderBy: { createdAt: "asc" },
    });

    return results
      .map((result, index) =>
        [
          `Result ${index + 1} (${result.provider}/${result.model})`,
          result.outputText || result.errorMessage || "",
        ].join("\n"),
      )
      .join("\n\n");
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

  await prisma.workbenchSession.update({
    where: { id: session.id },
    data: { updatedAt: new Date() },
  });

  return {
    session,
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
