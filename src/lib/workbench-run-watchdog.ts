import "server-only";

import { prisma } from "@/lib/prisma";
import { ensureWorkbenchRunSchema } from "@/lib/workbench-run-schema";
import {
  releaseUsageReservation,
  settleUsageReservation,
} from "@/lib/usage-policy";

const DEFAULT_STALE_RUN_SECONDS = 1800;

function getStaleRunSeconds() {
  const raw = process.env.WORKBENCH_STALE_RUN_SECONDS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(parsed) && parsed >= 300) {
    return parsed;
  }

  return DEFAULT_STALE_RUN_SECONDS;
}

function staleRunMessage(staleSeconds: number) {
  return `The AI run did not return for ${staleSeconds} seconds and was stopped automatically.`;
}

export async function closeStaleWorkbenchRuns(input: {
  userId?: string;
  executionRunId?: string;
}) {
  await ensureWorkbenchRunSchema();
  const staleSeconds = getStaleRunSeconds();
  const cutoff = new Date(Date.now() - staleSeconds * 1000);
  const message = staleRunMessage(staleSeconds);
  const baseFilters = {
    updatedAt: { lt: cutoff },
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.executionRunId ? { id: input.executionRunId } : {}),
  };
  const staleActiveRuns = await prisma.executionRun.findMany({
    where: {
      ...baseFilters,
      status: { in: ["queued", "running"] },
    },
    orderBy: { updatedAt: "asc" },
    take: 20,
    select: {
      id: true,
      userId: true,
      sessionId: true,
      requestType: true,
      inputCharCount: true,
      usageReservationId: true,
      status: true,
      startedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const staleCanceledWithReservation = await prisma.executionRun.findMany({
    where: {
      ...baseFilters,
      status: "canceled",
      usageReservationId: { not: null },
    },
    orderBy: { updatedAt: "asc" },
    take: 20,
    select: {
      id: true,
      userId: true,
      sessionId: true,
      requestType: true,
      inputCharCount: true,
      usageReservationId: true,
      status: true,
      startedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const staleCanceledRunningResultRows = await prisma.result.findMany({
    where: {
      status: "running",
      createdAt: { lt: cutoff },
      executionRunId: input.executionRunId ?? undefined,
      ...(input.userId
        ? { session: { userId: input.userId } }
        : {}),
    },
    select: {
      executionRunId: true,
    },
    distinct: ["executionRunId"],
    take: 20,
  });
  const staleCanceledRunningRunIds = staleCanceledRunningResultRows
    .map((row) => row.executionRunId)
    .filter((value): value is string => Boolean(value));
  const staleCanceledWithRunningResults = staleCanceledRunningRunIds.length
    ? await prisma.executionRun.findMany({
        where: {
          ...baseFilters,
          id: { in: staleCanceledRunningRunIds },
          status: "canceled",
        },
        orderBy: { updatedAt: "asc" },
        take: 20,
        select: {
          id: true,
          userId: true,
          sessionId: true,
          requestType: true,
          inputCharCount: true,
          usageReservationId: true,
          status: true,
          startedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    : [];
  const staleRuns = Array.from(
    new Map(
      [
        ...staleActiveRuns,
        ...staleCanceledWithReservation,
        ...staleCanceledWithRunningResults,
      ].map((run) => [run.id, run]),
    ).values(),
  )
    .sort((left, right) => left.updatedAt.getTime() - right.updatedAt.getTime())
    .slice(0, 20);

  for (const run of staleRuns) {
    const finishedAt = new Date();
    const sessionResults = run.startedAt
      ? await prisma.result.findMany({
          where: {
            executionRunId: run.id,
          },
          select: {
            provider: true,
            model: true,
            status: true,
            tokenUsagePrompt: true,
            tokenUsageCompletion: true,
            estimatedCost: true,
          },
        })
      : [];

    if (run.sessionId && run.startedAt) {
      await prisma.result.updateMany({
        where: {
          executionRunId: run.id,
          status: "running",
        },
        data: {
          status: run.status === "canceled" ? "canceled" : "failed",
          errorMessage: run.status === "canceled" ? "The run was stopped by the user." : message,
          updatedAt: finishedAt,
        },
      });
    }

    const chargeableResults = sessionResults.filter(
      (result) => result.status === "completed" || result.status === "failed",
    );

    if (run.usageReservationId) {
      if (chargeableResults.length) {
        await settleUsageReservation({
          reservationId: run.usageReservationId,
          userId: run.userId,
          requestType: run.requestType,
          selectedModels: Array.from(
            new Set(
              chargeableResults.map(
                (result) => `${result.provider}/${result.model}`,
              ),
            ),
          ),
          inputCharCount: run.inputCharCount,
          inputTokenCount: chargeableResults.reduce(
            (sum, result) => sum + (result.tokenUsagePrompt ?? 0),
            0,
          ),
          outputTokenCount: chargeableResults.reduce(
            (sum, result) => sum + (result.tokenUsageCompletion ?? 0),
            0,
          ),
          estimatedCostUsd: chargeableResults.reduce(
            (sum, result) => sum + (result.estimatedCost ?? 0),
            0,
          ),
        }).catch(() => undefined);
      } else {
        await releaseUsageReservation({
          reservationId: run.usageReservationId,
          userId: run.userId,
        }).catch(() => undefined);
      }
    }

    await prisma.executionRun.updateMany({
      where: {
        id: run.id,
        status: { in: ["queued", "running"] },
      },
      data: {
        status: "failed",
        errorMessage: message,
        streamError: message,
        finishedAt,
        updatedAt: finishedAt,
      },
    });

    if (run.status === "canceled") {
      await prisma.executionRun.updateMany({
        where: {
          id: run.id,
          status: "canceled",
        },
        data: {
          usageReservationId: null,
          updatedAt: finishedAt,
        },
      });
    }
  }

  return {
    closedCount: staleRuns.length,
    staleSeconds,
  };
}
