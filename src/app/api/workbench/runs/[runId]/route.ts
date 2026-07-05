import { NextResponse } from "next/server";
import { getRun } from "workflow/api";
import { apiErrorResponse, requireApiGenerationUser } from "@/lib/api-auth";
import {
  getExecutionRunForUser,
  cancelExecutionRunForUser,
  parseExecutionRunSummary,
  readSignedRunToken,
} from "@/lib/execution-runs";
import {
  cancelExecutionRunV2,
  getExecutionRunStatusSnapshot,
  rescueStalledExecutionRunV2,
} from "@/lib/execution-run-steps";
import { prisma } from "@/lib/prisma";
import { buildWorkbenchResultSelect } from "@/lib/workbench-result-read";
import { releaseUsageReservation } from "@/lib/usage-policy";
import { closeStaleWorkbenchRuns } from "@/lib/workbench-run-watchdog";
import { getWorkbenchSchemaCapabilities } from "@/server/workbench/schema-compat";
import { createServerTiming } from "@/server/perf/server-timing";
import { shouldRecoverLegacyRun } from "@/server/workbench/legacy-run-recovery-policy";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

async function handleGet(_request: Request, { params }: RouteContext) {
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

    const { supportsRunExecutionOrder } =
      await getWorkbenchSchemaCapabilities();
    if ("executionRunId" in token) {
      let executionRun = await getExecutionRunForUser({
        executionRunId: token.executionRunId,
        userId: user.id,
      });

      if (!executionRun) {
        return NextResponse.json({ error: "Run not found." }, { status: 404 });
      }

      if (shouldRecoverLegacyRun(executionRun)) {
        await closeStaleWorkbenchRuns({
          executionRunId: executionRun.id,
          userId: user.id,
        });
        executionRun = await getExecutionRunForUser({
          executionRunId: executionRun.id,
          userId: user.id,
        });
        if (!executionRun) {
          return NextResponse.json({ error: "Run not found." }, { status: 404 });
        }
      }

      if (executionRun.runnerVersion === "v2") {
        await rescueStalledExecutionRunV2({
          executionRunId: executionRun.id,
        }).catch(() => undefined);

        const [snapshot, results] = await Promise.all([
          getExecutionRunStatusSnapshot({
            executionRunId: executionRun.id,
            userId: user.id,
          }),
          prisma.result.findMany({
            where: { executionRunId: executionRun.id },
            orderBy: [{ executionOrder: "asc" }, { createdAt: "asc" }],
            select: buildWorkbenchResultSelect({
              includePromptSnapshot: true,
              includeOutputText: true,
              includeEncryptedOutput: true,
              includeRawResponse: true,
              includeBranching: true,
              includeUsage: true,
              includeExecutionFields: true,
              includeTimestamps: true,
              includeWorkflowStep: true,
            }),
          }),
        ]);

        if (!snapshot) {
          return NextResponse.json({ error: "Run not found." }, { status: 404 });
        }

        return NextResponse.json({
          runId,
          executionRunId: executionRun.id,
          mode: token.mode,
          status: snapshot.executionRun.status,
          createdAt: executionRun.createdAt.toISOString(),
          startedAt: executionRun.startedAt?.toISOString() ?? null,
          finishedAt: executionRun.finishedAt?.toISOString() ?? null,
          errorMessage: executionRun.errorMessage,
          streamError: executionRun.streamError,
          executionSummary: {
            plannedTotal: snapshot.executionRun.totalStepsPlanned,
            executedTotal:
              snapshot.executionRun.totalStepsDone +
              snapshot.executionRun.totalStepsFailed +
              snapshot.executionRun.totalStepsCanceled,
            stoppedEarly:
              ["partial", "failed", "canceled"].includes(snapshot.executionRun.status),
            stopReason:
              snapshot.executionRun.status === "canceled"
                ? "canceled"
                : snapshot.executionRun.status === "partial"
                  ? "partial"
                  : snapshot.executionRun.status === "failed"
                    ? "failed"
                    : null,
          },
          finalResultId: snapshot.executionRun.finalResultId,
          executionRun: snapshot.executionRun,
          runSteps: snapshot.runSteps,
          results,
        });
      }

      if (!executionRun.workflowRunId) {
        const results = await prisma.result.findMany({
          where: { executionRunId: executionRun.id },
          orderBy: { createdAt: "asc" },
          select: buildWorkbenchResultSelect({
            includePromptSnapshot: true,
            includeOutputText: true,
            includeEncryptedOutput: true,
            includeRawResponse: true,
            includeBranching: true,
            includeUsage: true,
            includeExecutionFields: supportsRunExecutionOrder,
            includeTimestamps: true,
            includeWorkflowStep: true,
          }),
        });
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
          results,
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

      const results = await prisma.result.findMany({
        where: { executionRunId: executionRun.id },
        orderBy: { createdAt: "asc" },
        select: buildWorkbenchResultSelect({
          includePromptSnapshot: true,
          includeOutputText: true,
          includeEncryptedOutput: true,
          includeRawResponse: true,
          includeBranching: true,
          includeUsage: true,
          includeExecutionFields: supportsRunExecutionOrder,
          includeTimestamps: true,
          includeWorkflowStep: true,
        }),
      });

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
        results,
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

async function handleDelete(_request: Request, { params }: RouteContext) {
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

    await getWorkbenchSchemaCapabilities();
    const executionRun = await getExecutionRunForUser({
      executionRunId: token.executionRunId,
      userId: user.id,
    });

    if (!executionRun) {
      return NextResponse.json({ error: "Run not found." }, { status: 404 });
    }

    if (executionRun.runnerVersion === "v2") {
      const canceledRun = await cancelExecutionRunV2({
        executionRunId: executionRun.id,
        userId: user.id,
        reason: "The run was stopped by the user.",
      });

      return NextResponse.json({
        ok: true,
        runId,
        executionRunId: executionRun.id,
        status: canceledRun?.status ?? executionRun.status,
      });
    }

    const canceledRun = await cancelExecutionRunForUser({
      executionRunId: executionRun.id,
      userId: user.id,
      reason: "The run was stopped by the user.",
    });
    const cancelBeforeWorkflowStarted =
      canceledRun?.status === "canceled" && canceledRun.startedAt === null;

    if (
      canceledRun?.usageReservationId &&
      cancelBeforeWorkflowStarted &&
      canceledRun.totalStepsDone === 0
    ) {
      await releaseUsageReservation({
        reservationId: canceledRun.usageReservationId,
        userId: user.id,
      }).catch(() => undefined);
    }

    if (executionRun.workflowRunId && cancelBeforeWorkflowStarted) {
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

export async function GET(request: Request, context: RouteContext) {
  const timing = createServerTiming();
  const response = await timing.measure("run_status", () =>
    handleGet(request, context),
  );
  timing.apply(response.headers);
  return response;
}

export async function DELETE(request: Request, context: RouteContext) {
  const timing = createServerTiming();
  const response = await timing.measure("run_cancel", () =>
    handleDelete(request, context),
  );
  timing.apply(response.headers);
  return response;
}
