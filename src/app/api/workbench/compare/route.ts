import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import {
  findSavedParallelComparison,
  generateParallelComparisonSummary,
} from "@/lib/ai/workflow";
import { assertProvidersReadyForRun } from "@/lib/provider-availability";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
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

    const comparison = await generateParallelComparisonSummary({
      userId: user.id,
      sessionId: body.sessionId,
      resultIds,
    });

    return NextResponse.json({ comparison, cached: false });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
