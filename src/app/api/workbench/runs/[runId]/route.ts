import { NextResponse } from "next/server";
import { getRun } from "workflow/api";
import { apiErrorResponse, requireApiGenerationUser } from "@/lib/api-auth";
import {
  cancelExecutionRunForUser,
  getExecutionRunForUser,
  parseExecutionRunSummary,
  readSignedRunToken,
} from "@/lib/execution-runs";
import { releaseUsageReservation } from "@/lib/usage-policy";

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

    if ("executionRunId" in token) {
      const executionRun = await getExecutionRunForUser({
        executionRunId: token.executionRunId,
        userId: user.id,
      });

      if (!executionRun) {
        return NextResponse.json({ error: "Run not found." }, { status: 404 });
      }

      if (!executionRun.workflowRunId) {
        return NextResponse.json({
          runId,
          executionRunId: executionRun.id,
          mode: token.mode,
          status: executionRun.status,
          createdAt: executionRun.createdAt.toISOString(),
          startedAt: executionRun.startedAt?.toISOString() ?? null,
          finishedAt: executionRun.finishedAt?.toISOString() ?? null,
          errorMessage: executionRun.errorMessage,
          streamError: executionRun.streamError,
          executionSummary: parseExecutionRunSummary(executionRun.executionSummaryJson),
          finalResultId: executionRun.finalResultId,
        });
      }

      const run = getRun(executionRun.workflowRunId);
      const [workflowStatus, createdAt, startedAt, completedAt] = await Promise.all([
        run.status,
        run.createdAt,
        run.startedAt,
        run.completedAt,
      ]);

      const resolvedStatus =
        ["completed", "partial", "failed", "canceled"].includes(executionRun.status)
          ? executionRun.status
          : workflowStatus;

      return NextResponse.json({
        runId,
        executionRunId: executionRun.id,
        workflowRunId: executionRun.workflowRunId,
        mode: token.mode,
        status: resolvedStatus,
        createdAt: executionRun.createdAt.toISOString() ?? createdAt.toISOString(),
        startedAt:
          executionRun.startedAt?.toISOString() ??
          startedAt?.toISOString() ??
          null,
        finishedAt:
          executionRun.finishedAt?.toISOString() ??
          completedAt?.toISOString() ??
          null,
        errorMessage:
          executionRun.errorMessage ??
          (workflowStatus === "failed" ? "The durable AI run failed." : null),
        streamError: executionRun.streamError,
        executionSummary: parseExecutionRunSummary(executionRun.executionSummaryJson),
        finalResultId: executionRun.finalResultId,
      });
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

export async function DELETE(_request: Request, { params }: RouteContext) {
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

    const canceledRun = await cancelExecutionRunForUser({
      executionRunId: executionRun.id,
      userId: user.id,
      reason: "The run was stopped by the user.",
    });

    if (
      executionRun.usageReservationId &&
      executionRun.totalStepsDone === 0
    ) {
      await releaseUsageReservation({
        reservationId: executionRun.usageReservationId,
        userId: user.id,
      }).catch(() => undefined);
    }

    if (executionRun.workflowRunId) {
      await getRun(executionRun.workflowRunId).cancel().catch(() => undefined);
    }

    return NextResponse.json({
      ok: true,
      runId,
      executionRunId: executionRun.id,
      status: canceledRun?.status ?? executionRun.status,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
