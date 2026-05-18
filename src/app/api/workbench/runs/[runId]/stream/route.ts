import { getRun } from "workflow/api";
import { apiErrorResponse, requireApiGenerationUser } from "@/lib/api-auth";
import {
  getExecutionRunForUser,
  parseExecutionRunSummary,
  readSignedRunToken,
} from "@/lib/execution-runs";
import { prisma } from "@/lib/prisma";
import { ensureWorkbenchRunSchema } from "@/lib/workbench-run-schema";
import { closeStaleWorkbenchRuns } from "@/lib/workbench-run-watchdog";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const user = await requireApiGenerationUser();
    const { runId } = await params;
    let token;
    try {
      token = readSignedRunToken(decodeURIComponent(runId));
    } catch {
      return Response.json({ error: "Run not found." }, { status: 404 });
    }
    const { searchParams } = new URL(request.url);
    const startIndexParam = searchParams.get("startIndex");
    const startIndex =
      startIndexParam !== null ? Number.parseInt(startIndexParam, 10) : undefined;

    if (token.userId !== user.id) {
      return Response.json({ error: "Run not found." }, { status: 404 });
    }

    await ensureWorkbenchRunSchema();
    let executionRun =
      "executionRunId" in token
        ? await getExecutionRunForUser({
            executionRunId: token.executionRunId,
            userId: user.id,
          })
        : null;

    if ("executionRunId" in token && !executionRun) {
      return Response.json({ error: "Run not found." }, { status: 404 });
    }

    if ("executionRunId" in token) {
      await closeStaleWorkbenchRuns({
        executionRunId: token.executionRunId,
        userId: user.id,
      });
      executionRun = await getExecutionRunForUser({
        executionRunId: token.executionRunId,
        userId: user.id,
      });

      if (executionRun?.status === "canceled") {
        const [session, results] = await Promise.all([
          executionRun.sessionId
            ? prisma.workbenchSession.findFirst({
                where: { id: executionRun.sessionId, userId: user.id },
                select: { id: true, title: true },
              })
            : null,
          executionRun.startedAt
            ? prisma.result.findMany({
                where: {
                  executionRunId: executionRun.id,
                },
                orderBy: { createdAt: "asc" },
                include: {
                  workflowStep: {
                    select: { orderIndex: true, actionType: true },
                  },
                },
              })
            : [],
        ]);
        const encoder = new TextEncoder();
        return new Response(
          encoder.encode(
            `${JSON.stringify({
              type: "done",
              session: session
                ? {
                    id: session.id,
                    title: session.title,
                    finalResultId: executionRun.finalResultId,
                  }
                : undefined,
              results,
              executionSummary:
                parseExecutionRunSummary(executionRun.executionSummaryJson) ?? {
                  plannedTotal: executionRun.totalStepsPlanned,
                  executedTotal: executionRun.totalStepsDone,
                  stoppedEarly: true,
                  stopReason: "canceled",
                },
            })}\n`,
          ),
          {
            headers: {
              "Content-Type": "application/x-ndjson; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
            },
          },
        );
      }

      if (executionRun?.status === "failed") {
        const encoder = new TextEncoder();
        return new Response(
          encoder.encode(
            `${JSON.stringify({
              type: "error",
              error:
                executionRun.streamError ||
                executionRun.errorMessage ||
                "The AI run stopped before returning a result.",
            })}\n`,
          ),
          {
            headers: {
              "Content-Type": "application/x-ndjson; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
            },
          },
        );
      }
    }

    const workflowRunId =
      "executionRunId" in token ? executionRun?.workflowRunId : token.workflowRunId;

    if (!workflowRunId) {
      return Response.json({ error: "Run is still being queued.", status: "queued" }, { status: 409 });
    }

    const run = getRun(workflowRunId);
    const readable = run.getReadable(
      startIndex === undefined || Number.isNaN(startIndex)
        ? undefined
        : { startIndex },
    );
    const tailIndex = await readable.getTailIndex();
    const encoder = new TextEncoder();

    const ndjsonStream = (readable as ReadableStream<unknown>).pipeThrough(
      new TransformStream<unknown, Uint8Array>({
        transform(chunk, controller) {
          controller.enqueue(encoder.encode(`${JSON.stringify(chunk)}\n`));
        },
      }),
    );

    return new Response(ndjsonStream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Workflow-Stream-Tail-Index": String(tailIndex),
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
