import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import {
  findSavedParallelComparison,
  generateParallelComparisonSummary,
} from "@/lib/ai/workflow";
import { estimateComparisonSummaryCredits } from "@/lib/credits";
import { prisma } from "@/lib/prisma";
import { assertProvidersReadyForRun } from "@/lib/provider-availability";
import {
  releaseUsageReservation,
  requireUsageAccess,
  reserveUsage,
  settleUsageReservation,
} from "@/lib/usage-policy";

export async function POST(request: Request) {
  let userId = "";
  let reservedUsage: { id: string } | null = null;
  let comparisonGenerated = false;

  try {
    const user = await requireApiUser();
    userId = user.id;
    const body = (await request.json()) as {
      sessionId?: string;
      resultIds?: string[];
      refresh?: boolean;
    };

    if (!body.sessionId) {
      return NextResponse.json(
        { error: "Session id is required." },
        { status: 400 },
      );
    }

    const resultIds = Array.isArray(body.resultIds) ? body.resultIds : undefined;

    // Reuse a previously generated comparison for this exact set of results so
    // re-opening the workbench loads the saved summary instead of re-comparing.
    if (!body.refresh) {
      const cached = await findSavedParallelComparison({
        userId: user.id,
        sessionId: body.sessionId,
        resultIds,
      });
      if (cached) {
        return NextResponse.json({ comparison: cached, cached: true });
      }
    }

    const providerError = await assertProvidersReadyForRun(["openai"], user.id);
    if (providerError) {
      return NextResponse.json({ error: providerError }, { status: 400 });
    }

    const session = await prisma.workbenchSession.findFirst({
      where: { id: body.sessionId, userId: user.id },
      select: { id: true, originalInput: true },
    });
    if (!session) {
      return NextResponse.json(
        { error: "Session was not found for comparison." },
        { status: 404 },
      );
    }

    const completedResults = await prisma.result.findMany({
      where: {
        sessionId: session.id,
        status: "completed",
        ...(resultIds?.length ? { id: { in: resultIds } } : {}),
      },
      select: {
        outputText: true,
      },
    });
    const resultTextLengths = completedResults
      .map((result) => result.outputText?.trim().length ?? 0)
      .filter((length) => length > 0);
    const averageResultCharCount =
      resultTextLengths.length > 0
        ? Math.ceil(
            resultTextLengths.reduce((sum, length) => sum + length, 0) /
              resultTextLengths.length,
          )
        : 3000;
    const creditEstimate = estimateComparisonSummaryCredits({
      originalInput: session.originalInput,
      resultCount: resultTextLengths.length,
      averageResultCharCount,
    });
    const inputCharCount =
      session.originalInput.length +
      resultTextLengths.reduce((sum, length) => sum + length, 0);
    const usageContext = await requireUsageAccess({
      userId: user.id,
      inputCharCount,
      estimatedCredits: creditEstimate.estimatedCredits,
    });
    reservedUsage = await reserveUsage({
      userId: user.id,
      requestType: "parallel_comparison_summary",
      inputCharCount,
      reservationKey: `compare-summary:${crypto.randomUUID()}`,
      estimatedCredits: creditEstimate.estimatedCredits,
      estimatedCostUsd: creditEstimate.estimatedRawCostUsd,
      maxApprovedCredits: creditEstimate.estimatedCredits,
      pricingVersion: creditEstimate.pricingVersion,
      quote: creditEstimate,
      context: usageContext ?? undefined,
    });

    const comparison = await generateParallelComparisonSummary({
      userId: user.id,
      sessionId: body.sessionId,
      resultIds,
    });
    comparisonGenerated = true;
    const usage = await settleUsageReservation({
      reservationId: reservedUsage?.id,
      userId: user.id,
      requestType: "parallel_comparison_summary",
      selectedModels: [`${comparison.provider}/${comparison.model}`],
      inputCharCount,
      inputTokenCount: comparison.inputTokenCount ?? 0,
      outputTokenCount: comparison.outputTokenCount ?? 0,
      estimatedCostUsd: comparison.estimatedCostUsd ?? 0,
    });

    return NextResponse.json({
      comparison,
      cached: false,
      usage,
      creditEstimate,
    });
  } catch (error) {
    if (reservedUsage && userId && !comparisonGenerated) {
      await releaseUsageReservation({
        reservationId: reservedUsage.id,
        userId,
      }).catch(() => undefined);
    }
    return apiErrorResponse(error);
  }
}
