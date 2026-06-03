import "server-only";

import { randomBytes } from "node:crypto";
import type { ActionType, ProviderName } from "@/lib/ai/types";
import { prisma } from "@/lib/prisma";
import {
  buildSharedResultPath,
  buildSharedSessionPath,
} from "@/lib/workbench-sharing";
import { ensureResultExecutionRunIdColumn } from "@/lib/workbench-run-schema";
import {
  buildWorkbenchResultSelect,
  ensureWorkbenchResultReadSchema,
} from "@/lib/workbench-result-read";
import {
  ensureWorkflowControlJsonColumn,
  ensureWorkflowTemplateStepsJsonColumn,
} from "@/lib/workbench-session-schema";

type SharedWorkflowStep = {
  id: string;
  orderIndex: number;
  actionType: ActionType;
  targetProvider: ProviderName;
  targetModel: string;
  sourceMode: string;
  sourceResultId: string | null;
  instructionTemplate: string | null;
};

export type SharedWorkbenchResult = {
  id: string;
  executionOrder?: number | null;
  workflowStepId: string | null;
  parentResultId: string | null;
  branchKey: string | null;
  provider: ProviderName;
  model: string;
  outputText: string | null;
  status: string;
  errorMessage: string | null;
  tokenUsagePrompt: number | null;
  tokenUsageCompletion: number | null;
  estimatedCost: number | null;
  costIsEstimated: boolean;
  latencyMs: number | null;
  createdAt: string;
  updatedAt: string;
  workflowStep?: {
    orderIndex: number;
    actionType: ActionType;
  } | null;
  executionRunStep?: {
    orderIndex: number;
    templateStepIndex: number;
    repeatIteration: number | null;
    actionType: ActionType;
    targetProvider: string;
    targetModel: string;
    status: string;
  } | null;
};

export type SharedSessionPayload = {
  token: string;
  session: {
    id: string;
    title: string;
    originalInput: string;
    additionalInstruction: string | null;
    outputStyle: string | null;
    outputLanguage: string | null;
    mode: "parallel" | "sequential";
    finalResultId: string | null;
    workflowSteps: SharedWorkflowStep[];
    results: SharedWorkbenchResult[];
  };
};

function parseWorkflowTemplateStepsJson(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function newShareToken() {
  return randomBytes(18).toString("base64url");
}

async function createSharedLink(input: { userId: string; sessionId: string }) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.sharedLink.create({
        data: {
          userId: input.userId,
          sessionId: input.sessionId,
          token: newShareToken(),
        },
        select: { token: true },
      });
    } catch (error) {
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code?: string }).code === "string"
          ? (error as { code: string }).code
          : null;

      if (code !== "P2002") {
        throw error;
      }
    }
  }

  throw new Error("Could not create a unique share token.");
}

export async function getOrCreateSharedLink(input: {
  userId: string;
  sessionId: string;
}) {
  const session = await prisma.workbenchSession.findFirst({
    where: { id: input.sessionId, userId: input.userId },
    select: { id: true },
  });

  if (!session) {
    throw new Error("Session not found.");
  }

  const existing = await prisma.sharedLink.findUnique({
    where: { sessionId: session.id },
    select: { token: true },
  });

  if (existing) {
    return existing;
  }

  const created = await createSharedLink({
    userId: input.userId,
    sessionId: session.id,
  });

  return created;
}

export async function verifySharedResultBelongsToSession(input: {
  sessionId: string;
  resultId: string;
}) {
  const result = await prisma.result.findFirst({
    where: {
      id: input.resultId,
      sessionId: input.sessionId,
    },
    select: { id: true },
  });

  return Boolean(result);
}

export async function getSharedSessionPayload(
  token: string,
): Promise<SharedSessionPayload | null> {
  const [supportsWorkflowControl, supportsWorkflowTemplateSteps] =
    await Promise.all([
      ensureWorkflowControlJsonColumn(),
      ensureWorkflowTemplateStepsJsonColumn(),
    ]);
  await ensureResultExecutionRunIdColumn();
  const { supportsRunExecutionOrder } =
    await ensureWorkbenchResultReadSchema();

  const sharedLink = await prisma.sharedLink.findUnique({
    where: { token },
    select: {
      token: true,
      session: {
        select: {
          id: true,
          title: true,
          originalInput: true,
          additionalInstruction: true,
          outputStyle: true,
          outputLanguage: true,
          mode: true,
          finalResultId: true,
          ...(supportsWorkflowControl ? { workflowControlJson: true } : {}),
          ...(supportsWorkflowTemplateSteps
            ? { workflowTemplateStepsJson: true }
            : {}),
          workflowSteps: {
            orderBy: { orderIndex: "asc" },
            select: {
              id: true,
              orderIndex: true,
              actionType: true,
              targetProvider: true,
              targetModel: true,
              sourceMode: true,
              sourceResultId: true,
              instructionTemplate: true,
            },
          },
          results: {
            orderBy: [{ executionOrder: "asc" }, { createdAt: "asc" }],
            select: buildWorkbenchResultSelect({
              includeOutputText: true,
              includeBranching: true,
              includeUsage: true,
              includeExecutionFields: supportsRunExecutionOrder,
              includeTimestamps: true,
              includeWorkflowStep: true,
            }),
          },
        },
      },
    },
  });

  if (!sharedLink) {
    return null;
  }

  const session = sharedLink.session;
  const workflowSteps =
    parseWorkflowTemplateStepsJson(
      (session as { workflowTemplateStepsJson?: string | null })
        .workflowTemplateStepsJson,
    ) ?? session.workflowSteps;

  return {
    token: sharedLink.token,
    session: {
      id: session.id,
      title: session.title,
      originalInput: session.originalInput,
      additionalInstruction: session.additionalInstruction,
      outputStyle: session.outputStyle,
      outputLanguage: session.outputLanguage ?? null,
      mode: session.mode === "sequential" ? "sequential" : "parallel",
      finalResultId: session.finalResultId,
      workflowSteps: (workflowSteps as SharedWorkflowStep[]).map((step) => ({
        ...step,
        actionType: step.actionType as ActionType,
        targetProvider: step.targetProvider as ProviderName,
      })),
      results: session.results.map((result) => ({
        ...result,
        provider: result.provider as ProviderName,
        workflowStep: result.workflowStep
          ? {
              ...result.workflowStep,
              actionType: result.workflowStep.actionType as ActionType,
            }
          : null,
        executionRunStep: result.executionRunStep
          ? {
              ...result.executionRunStep,
              actionType: result.executionRunStep.actionType as ActionType,
            }
          : null,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
      })),
    },
  };
}

export function buildSharedLinkResponse(input: {
  token: string;
  resultId?: string | null;
}) {
  return {
    token: input.token,
    sessionPath: buildSharedSessionPath(input.token),
    resultPath: input.resultId
      ? buildSharedResultPath(input.token, input.resultId)
      : null,
  };
}
