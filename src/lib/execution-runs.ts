import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { calculateExpandedStepCount } from "@/lib/ai/workflow-control";
import { prisma } from "@/lib/prisma";
import type { WorkflowStepInput } from "@/lib/ai/types";
import type { UsageCheckContext } from "@/lib/usage-policy";
import type { RunWorkbenchInput } from "@/lib/validation";

const ACTIVE_RUN_STATUSES = ["queued", "running"] as const;
const DEFAULT_MAX_ACTIVE_RUNS_PER_USER = 3;

export type SerializedUsageCheckContext = {
  policy: Omit<UsageCheckContext["policy"], "resetAt"> & {
    resetAt: string;
  };
  usage: UsageCheckContext["usage"];
};

type LegacySignedRunPayload = {
  workflowRunId: string;
  userId: string;
  mode: RunWorkbenchInput["mode"];
  createdAt: string;
};

type ExecutionSignedRunPayload = {
  executionRunId: string;
  userId: string;
  mode: RunWorkbenchInput["mode"];
  createdAt: string;
};

export type SignedRunPayload =
  | LegacySignedRunPayload
  | ExecutionSignedRunPayload;

export type ExecutionRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "partial"
  | "failed"
  | "canceled";

type CreateExecutionRunInput = {
  userId: string;
  sessionId?: string | null;
  mode: RunWorkbenchInput["mode"];
  requestType: "compare" | "sequential";
  inputCharCount: number;
  totalStepsPlanned: number;
  usageReservationId?: string | null;
};

type CompleteExecutionRunInput = {
  executionRunId: string;
  status: "completed" | "partial" | "canceled";
  sessionId?: string | null;
  finalResultId?: string | null;
  streamError?: string | null;
  executionSummary?: {
    plannedTotal: number;
    executedTotal: number;
    stoppedEarly: boolean;
    stopReason?: string | null;
  } | null;
};

type ExecutionRunSummary = {
  plannedTotal: number;
  executedTotal: number;
  stoppedEarly: boolean;
  stopReason?: string | null;
} | null;

function getSerializableRetries() {
  return 3;
}

async function withSerializableRetries<T>(
  callback: () => Promise<T>,
  retries = getSerializableRetries(),
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < retries) {
    try {
      return await callback();
    } catch (error) {
      const prismaCode = error instanceof Prisma.PrismaClientKnownRequestError
        ? error.code
        : null;
      if (prismaCode !== "P2034") {
        throw error;
      }
      lastError = error;
      attempt += 1;
    }
  }

  throw lastError ?? new Error("The transaction could not be completed.");
}

export class ActiveRunLimitReachedError extends Error {
  constructor(message = "Too many active AI runs are already in progress.") {
    super(message);
  }
}

export class ActiveSessionRunExistsError extends Error {
  constructor(message = "This session already has an AI run in progress.") {
    super(message);
  }
}

export function serializeUsageCheckContext(
  context: UsageCheckContext,
): SerializedUsageCheckContext {
  return {
    policy: {
      ...context.policy,
      resetAt: context.policy.resetAt.toISOString(),
    },
    usage: context.usage,
  };
}

export function deserializeUsageCheckContext(
  context: SerializedUsageCheckContext,
): UsageCheckContext {
  return {
    policy: {
      ...context.policy,
      resetAt: new Date(context.policy.resetAt),
    },
    usage: {
      ...context.usage,
      pendingReservedRequests: context.usage.pendingReservedRequests ?? 0,
    },
  };
}

export function calculatePlannedExecutionTotal(
  input: Pick<
    RunWorkbenchInput,
    "mode" | "targets" | "steps" | "workflowControl"
  >,
) {
  if (input.mode === "parallel") {
    return input.targets?.length ?? 0;
  }

  return calculateExpandedStepCount(
    (input.steps ?? []) as WorkflowStepInput[],
    input.workflowControl,
  );
}

function getRunTokenSecret() {
  const secret = process.env.APP_SECRET?.trim();
  if (!secret) {
    throw new Error("APP_SECRET is required to sign durable run tokens.");
  }
  return secret;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getMaxActiveRunsPerUser() {
  const rawValue = process.env.WORKBENCH_MAX_ACTIVE_RUNS_PER_USER?.trim();
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_MAX_ACTIVE_RUNS_PER_USER;
}

export async function createQueuedExecutionRun(input: CreateExecutionRunInput) {
  return withSerializableRetries(() =>
    prisma.$transaction(
      async (tx) => {
        const activeCount = await tx.executionRun.count({
          where: {
            userId: input.userId,
            status: { in: [...ACTIVE_RUN_STATUSES] },
          },
        });

        if (activeCount >= getMaxActiveRunsPerUser()) {
          throw new ActiveRunLimitReachedError(
            `You already have ${activeCount} active AI runs. Wait for one to finish before starting another.`,
          );
        }

        if (input.sessionId) {
          const sessionActiveRun = await tx.executionRun.findFirst({
            where: {
              userId: input.userId,
              sessionId: input.sessionId,
              status: { in: [...ACTIVE_RUN_STATUSES] },
            },
            select: { id: true },
          });

          if (sessionActiveRun) {
            throw new ActiveSessionRunExistsError(
              "This workbench session is already running. Wait for it to finish or resume the active run.",
            );
          }
        }

        return tx.executionRun.create({
          data: {
            userId: input.userId,
            sessionId: input.sessionId ?? null,
            mode: input.mode,
            requestType: input.requestType,
            status: "queued",
            inputCharCount: input.inputCharCount,
            totalStepsPlanned: input.totalStepsPlanned,
            usageReservationId: input.usageReservationId ?? null,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}

export async function assignWorkflowRunToExecutionRun(input: {
  executionRunId: string;
  workflowRunId: string;
}) {
  return prisma.executionRun.update({
    where: { id: input.executionRunId },
    data: {
      workflowRunId: input.workflowRunId,
      updatedAt: new Date(),
    },
  });
}

export async function markExecutionRunRunning(executionRunId: string) {
  return prisma.executionRun.updateMany({
    where: {
      id: executionRunId,
      status: { in: [...ACTIVE_RUN_STATUSES] },
    },
    data: {
      status: "running",
      startedAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

export async function updateExecutionRunSession(input: {
  executionRunId: string;
  sessionId: string;
  finalResultId?: string | null;
}) {
  return prisma.executionRun.update({
    where: { id: input.executionRunId },
    data: {
      sessionId: input.sessionId,
      ...(input.finalResultId !== undefined
        ? { finalResultId: input.finalResultId }
        : {}),
      updatedAt: new Date(),
    },
  });
}

export async function updateExecutionRunProgress(input: {
  executionRunId: string;
  totalStepsDone: number;
  sessionId?: string | null;
}) {
  return prisma.executionRun.updateMany({
    where: {
      id: input.executionRunId,
      status: { in: [...ACTIVE_RUN_STATUSES] },
    },
    data: {
      totalStepsDone: input.totalStepsDone,
      status: "running",
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      updatedAt: new Date(),
    },
  });
}

export async function completeExecutionRun(input: CompleteExecutionRunInput) {
  if (input.status !== "canceled") {
    const current = await prisma.executionRun.findUnique({
      where: { id: input.executionRunId },
      select: { id: true, status: true },
    });

    if (
      current?.status === "canceled" ||
      current?.status === "failed"
    ) {
      return current;
    }
  }

  return prisma.executionRun.update({
    where: { id: input.executionRunId },
    data: {
      status: input.status,
      sessionId: input.sessionId ?? undefined,
      finalResultId: input.finalResultId ?? null,
      streamError: input.streamError ?? null,
      executionSummaryJson: input.executionSummary
        ? JSON.stringify(input.executionSummary)
        : null,
      finishedAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

export async function failExecutionRun(input: {
  executionRunId: string;
  errorMessage: string;
}) {
  const current = await prisma.executionRun.findUnique({
    where: { id: input.executionRunId },
    select: { id: true, status: true },
  });

  if (current?.status === "canceled") {
    return current;
  }

  if (current?.status === "failed") {
    return current;
  }

  return prisma.executionRun.update({
    where: { id: input.executionRunId },
    data: {
      status: "failed",
      errorMessage: input.errorMessage,
      streamError: input.errorMessage,
      finishedAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

export async function cancelExecutionRunForUser(input: {
  executionRunId: string;
  userId: string;
  reason?: string;
}) {
  const current = await getExecutionRunForUser(input);

  if (!current) {
    return null;
  }

  if (!ACTIVE_RUN_STATUSES.includes(current.status as (typeof ACTIVE_RUN_STATUSES)[number])) {
    return current;
  }

  return prisma.executionRun.update({
    where: { id: current.id },
    data: {
      status: "canceled",
      errorMessage: input.reason ?? null,
      streamError: input.reason ?? "The run was stopped by the user.",
      finishedAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

export async function isExecutionRunCanceled(executionRunId: string) {
  const executionRun = await prisma.executionRun.findUnique({
    where: { id: executionRunId },
    select: { status: true },
  });

  return executionRun?.status === "canceled";
}

export async function getExecutionRunForUser(input: {
  executionRunId: string;
  userId: string;
}) {
  return prisma.executionRun.findFirst({
    where: {
      id: input.executionRunId,
      userId: input.userId,
    },
  });
}

export async function getLatestActiveExecutionRunForSession(input: {
  sessionId: string;
  userId: string;
}) {
  return prisma.executionRun.findFirst({
    where: {
      sessionId: input.sessionId,
      userId: input.userId,
      status: { in: [...ACTIVE_RUN_STATUSES] },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function parseExecutionRunSummary(
  executionSummaryJson: string | null | undefined,
): ExecutionRunSummary {
  if (!executionSummaryJson) {
    return null;
  }

  try {
    return JSON.parse(executionSummaryJson) as ExecutionRunSummary;
  } catch {
    return null;
  }
}

export function createSignedRunToken(payload: ExecutionSignedRunPayload) {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", getRunTokenSecret())
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

export function readSignedRunToken(token: string): SignedRunPayload {
  const [encodedPayload, encodedSignature] = token.split(".");
  if (!encodedPayload || !encodedSignature) {
    throw new Error("Run token is invalid.");
  }

  const expectedSignature = createHmac("sha256", getRunTokenSecret())
    .update(encodedPayload)
    .digest("base64url");

  const received = Buffer.from(encodedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    throw new Error("Run token signature is invalid.");
  }

  const parsed = JSON.parse(decodeBase64Url(encodedPayload)) as {
    executionRunId?: unknown;
    workflowRunId?: unknown;
    userId?: unknown;
    mode?: unknown;
    createdAt?: unknown;
  };

  if (
    typeof parsed.userId !== "string" ||
    typeof parsed.createdAt !== "string" ||
    (parsed.mode !== "parallel" && parsed.mode !== "sequential")
  ) {
    throw new Error("Run token payload is invalid.");
  }

  if (typeof parsed.executionRunId === "string") {
    return {
      executionRunId: parsed.executionRunId,
      userId: parsed.userId,
      mode: parsed.mode,
      createdAt: parsed.createdAt,
    };
  }

  if (typeof parsed.workflowRunId === "string") {
    return {
      workflowRunId: parsed.workflowRunId,
      userId: parsed.userId,
      mode: parsed.mode,
      createdAt: parsed.createdAt,
    };
  }

  throw new Error("Run token payload is invalid.");
}
