import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { generateParallelComparisonSummary } from "@/lib/ai/workflow";
import { assertProvidersReadyForRun } from "@/lib/provider-availability";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = (await request.json()) as {
      sessionId?: string;
      resultIds?: string[];
    };

    if (!body.sessionId) {
      return NextResponse.json(
        { error: "Session id is required." },
        { status: 400 },
      );
    }

    const providerError = await assertProvidersReadyForRun(["openai"], user.id);
    if (providerError) {
      return NextResponse.json({ error: providerError }, { status: 400 });
    }

    const comparison = await generateParallelComparisonSummary({
      userId: user.id,
      sessionId: body.sessionId,
      resultIds: Array.isArray(body.resultIds) ? body.resultIds : undefined,
    });

    return NextResponse.json({ comparison });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
