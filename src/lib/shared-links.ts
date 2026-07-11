import "server-only";

import crypto from "node:crypto";
import { SharedLinkScope } from "@prisma/client";
import type { ActionType, ProviderName } from "@/lib/ai/types";
import { prisma } from "@/lib/prisma";
import { buildSharedResultPath, buildSharedSessionPath } from "@/lib/workbench-sharing";
import { ensureResultExecutionRunIdColumn } from "@/lib/workbench-run-schema";
import { buildWorkbenchResultSelect, ensureWorkbenchResultReadSchema } from "@/lib/workbench-result-read";
import { ensureWorkflowControlJsonColumn, ensureWorkflowTemplateStepsJsonColumn } from "@/lib/workbench-session-schema";

const SHARE_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const COMPROMISED_TOKEN_HASHES = new Set([
  "60e34c06400f3f93364c9086aa2f3a116c222a112eae9312d2f9cbccecc25b5a",
]);

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
  workflowStep?: { orderIndex: number; actionType: ActionType } | null;
  executionRunStep?: {
    orderIndex: number;
    templateStepIndex: number;
    repeatIteration: number | null;
    actionType: ActionType;
    targetProvider: string;
    targetModel: string;
    sourceMode: string;
    sourceResultId: string | null;
    status: string;
  } | null;
};

export type SharedSessionPayload = {
  token: string;
  scope: "SESSION" | "RESULT";
  expiresAt: string;
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
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function newShareToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashShareToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createScopedSharedLink(input: {
  userId: string;
  sessionId: string;
  resultId?: string | null;
}) {
  const session = await prisma.workbenchSession.findFirst({
    where: { id: input.sessionId, userId: input.userId },
    select: { id: true },
  });
  if (!session) throw new Error("Session not found.");

  const scope = input.resultId ? SharedLinkScope.RESULT : SharedLinkScope.SESSION;
  if (input.resultId) {
    const valid = await verifySharedResultBelongsToSession({
      sessionId: session.id,
      resultId: input.resultId,
    });
    if (!valid) throw new Error("Result does not belong to this session.");
  }

  const expiresAt = new Date(Date.now() + SHARE_LINK_TTL_MS);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = newShareToken();
    try {
      await prisma.$transaction(async (tx) => {
        await tx.sharedLink.updateMany({
          where: {
            userId: input.userId,
            sessionId: session.id,
            scope,
            resultId: input.resultId ?? null,
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
        await tx.sharedLink.create({
          data: {
            userId: input.userId,
            sessionId: session.id,
            scope,
            resultId: input.resultId ?? null,
            tokenHash: hashShareToken(token),
            expiresAt,
          },
        });
      });
      return { token, scope, expiresAt };
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error
          ? String((error as { code?: string }).code)
          : null;
      if (code !== "P2002") throw error;
    }
  }
  throw new Error("Could not create a unique share token.");
}

export async function revokeSharedLinks(input: { userId: string; sessionId: string }) {
  const session = await prisma.workbenchSession.findFirst({
    where: { id: input.sessionId, userId: input.userId },
    select: { id: true },
  });
  if (!session) throw new Error("Session not found.");
  return prisma.sharedLink.updateMany({
    where: { sessionId: session.id, userId: input.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function verifySharedResultBelongsToSession(input: { sessionId: string; resultId: string }) {
  if (!input.resultId || input.resultId.length > 128) return false;
  const result = await prisma.result.findFirst({
    where: { id: input.resultId, sessionId: input.sessionId },
    select: { id: true },
  });
  return Boolean(result);
}

function serializeResults(results: Array<Record<string, unknown>>): SharedWorkbenchResult[] {
  return results.map((result) => {
    const source = result as Record<string, unknown> & {
      provider: string;
      createdAt: Date;
      updatedAt: Date;
      workflowStep?: { actionType: string } | null;
      executionRunStep?: { actionType: string } | null;
    };
    return ({
    ...source,
    provider: source.provider as ProviderName,
    workflowStep: source.workflowStep
      ? { ...source.workflowStep, actionType: source.workflowStep.actionType as ActionType }
      : null,
    executionRunStep: source.executionRunStep
      ? { ...source.executionRunStep, actionType: source.executionRunStep.actionType as ActionType }
      : null,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  }) as SharedWorkbenchResult;
  });
}

export async function getSharedSessionPayload(token: string): Promise<SharedSessionPayload | null> {
  if (!token || token.length < 32 || token.length > 128) return null;
  const tokenHash = hashShareToken(token);
  if (COMPROMISED_TOKEN_HASHES.has(tokenHash)) return null;

  const sharedLink = await prisma.sharedLink.findFirst({
    where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { sessionId: true, scope: true, resultId: true, expiresAt: true },
  });
  if (!sharedLink || (sharedLink.scope === SharedLinkScope.RESULT && !sharedLink.resultId)) return null;

  await ensureResultExecutionRunIdColumn();
  const { supportsRunExecutionOrder } = await ensureWorkbenchResultReadSchema();
  const resultSelect = buildWorkbenchResultSelect({
    includeOutputText: true,
    includeBranching: true,
    includeUsage: true,
    includeExecutionFields: supportsRunExecutionOrder,
    includeTimestamps: true,
    includeWorkflowStep: true,
  });

  if (sharedLink.scope === SharedLinkScope.RESULT) {
    const session = await prisma.workbenchSession.findUnique({
      where: { id: sharedLink.sessionId },
      select: {
        id: true,
        title: true,
        mode: true,
        finalResultId: true,
        results: { where: { id: sharedLink.resultId! }, select: resultSelect },
      },
    });
    if (!session || session.results.length !== 1) return null;
    return {
      token,
      scope: "RESULT",
      expiresAt: sharedLink.expiresAt.toISOString(),
      session: {
        id: session.id,
        title: session.title,
        originalInput: "",
        additionalInstruction: null,
        outputStyle: null,
        outputLanguage: null,
        mode: session.mode === "sequential" ? "sequential" : "parallel",
        finalResultId: session.finalResultId,
        workflowSteps: [],
        results: serializeResults(session.results),
      },
    };
  }

  const [supportsWorkflowControl, supportsWorkflowTemplateSteps] = await Promise.all([
    ensureWorkflowControlJsonColumn(),
    ensureWorkflowTemplateStepsJsonColumn(),
  ]);
  const session = await prisma.workbenchSession.findUnique({
    where: { id: sharedLink.sessionId },
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
      ...(supportsWorkflowTemplateSteps ? { workflowTemplateStepsJson: true } : {}),
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
        select: resultSelect,
      },
    },
  });
  if (!session) return null;

  const workflowSteps =
    parseWorkflowTemplateStepsJson(
      (session as { workflowTemplateStepsJson?: string | null }).workflowTemplateStepsJson,
    ) ?? session.workflowSteps;

  return {
    token,
    scope: "SESSION",
    expiresAt: sharedLink.expiresAt.toISOString(),
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
      results: serializeResults(session.results),
    },
  };
}

export function buildSharedLinkResponse(input: { token: string; resultId?: string | null; expiresAt: Date }) {
  return {
    token: input.token,
    expiresAt: input.expiresAt.toISOString(),
    sessionPath: buildSharedSessionPath(input.token),
    resultPath: input.resultId ? buildSharedResultPath(input.token, input.resultId) : null,
  };
}
