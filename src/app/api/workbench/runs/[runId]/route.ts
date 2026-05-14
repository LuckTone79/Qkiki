import { NextResponse } from "next/server";
import { getRun } from "workflow/api";
import { apiErrorResponse, requireApiGenerationUser } from "@/lib/api-auth";
import { readSignedRunToken } from "@/lib/execution-runs";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await requireApiGenerationUser();
    const { runId } = await params;
    let token;
    try {
      token = readSignedRunToken(decodeURIComponent(runId));
    } catch {
      return NextResponse.json({ error: "Run not found." }, { status: 404 });
    }

    if (token.userId !== user.id) {
      return NextResponse.json({ error: "Run not found." }, { status: 404 });
    }

    const run = getRun(token.workflowRunId);
    const [status, createdAt, startedAt, completedAt] = await Promise.all([
      run.status,
      run.createdAt,
      run.startedAt,
      run.completedAt,
    ]);

    return NextResponse.json({
      runId,
      workflowRunId: token.workflowRunId,
      mode: token.mode,
      status,
      createdAt: createdAt.toISOString(),
      startedAt: startedAt?.toISOString() ?? null,
      finishedAt: completedAt?.toISOString() ?? null,
      errorMessage:
        status === "failed" ? "The durable AI run failed." : null,
      streamError: null,
      executionSummary: null,
      finalResultId: null,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
