import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiGenerationUser } from "@/lib/api-auth";
import { cancelExecutionRunV2 } from "@/lib/execution-run-steps";
import { getExecutionRunForUser, readSignedRunToken } from "@/lib/execution-runs";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const user = await requireApiGenerationUser();
    const { runId } = await params;
    let token;
    try {
      token = readSignedRunToken(decodeURIComponent(runId));
    } catch {
      return NextResponse.json({ error: "Run not found." }, { status: 404 });
    }

    if (token.userId !== user.id || !("executionRunId" in token)) {
      return NextResponse.json({ error: "Run not found." }, { status: 404 });
    }

    const executionRun = await getExecutionRunForUser({
      executionRunId: token.executionRunId,
      userId: user.id,
    });

    if (!executionRun) {
      return NextResponse.json({ error: "Run not found." }, { status: 404 });
    }

    const canceled = await cancelExecutionRunV2({
      executionRunId: executionRun.id,
      userId: user.id,
      reason: "The run was stopped by the user.",
    });

    return NextResponse.json({
      ok: true,
      runId,
      executionRunId: executionRun.id,
      status: canceled?.status ?? executionRun.status,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
