import "server-only";

import { prisma } from "@/lib/prisma";
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
  const staleSeconds = getStaleRunSeconds();
  const cutoff = new Date(Date.now() - staleSeconds * 1000);
  const message = staleRunMessage(staleSeconds);

  const staleRuns = await prisma.executionRun.findMany({
    where: {
      status: { in: ["queued", "running"] },
      updatedAt: { lt: cutoff },
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.executionRunId ? { id: input.executionRunId } : {}),
    },
    take: 20,
    select: {
      id: true,
      userId: true,
      sessionId: true,
      requestType: true,
      inputCharCount: true,
      usageReservationId: true,
    },
  });

  for (const run of staleRuns) {
    const finishedAt = new Date();
    const sessionResults = run.sessionId
      ? await prisma.result.findMany({
          where: { sessionId: run.sessionId },
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

    if (run.sessionId) {
      await prisma.result.updateMany({
        where: {
          sessionId: run.sessionId,
          status: "running",
        },
        data: {
          status: "failed",
          errorMessage: message,
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
  }

  return {
    closedCount: staleRuns.length,
    staleSeconds,
  };
}
