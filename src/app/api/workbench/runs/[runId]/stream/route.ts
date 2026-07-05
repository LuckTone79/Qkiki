import { getRun } from "workflow/api";
import { apiErrorResponse, requireApiGenerationUser } from "@/lib/api-auth";
import {
  getExecutionRunForUser,
  parseExecutionRunSummary,
  readSignedRunToken,
} from "@/lib/execution-runs";
import {
  getExecutionRunStatusSnapshot,
  rescueStalledExecutionRunV2,
} from "@/lib/execution-run-steps";
import { prisma } from "@/lib/prisma";
import { buildWorkbenchResultSelect } from "@/lib/workbench-result-read";
import { closeStaleWorkbenchRuns } from "@/lib/workbench-run-watchdog";
import { getWorkbenchSchemaCapabilities } from "@/server/workbench/schema-compat";
import { createServerTiming } from "@/server/perf/server-timing";
import { shouldRecoverLegacyRun } from "@/server/workbench/legacy-run-recovery-policy";
import { getRunStreamCursor } from "@/server/workbench/run-stream-cursor";
import { getRunStreamPollDelayMs } from "@/server/workbench/run-stream-polling";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

const parsedV2StreamMaxMs = Number.parseInt(
  process.env.WORKBENCH_V2_STREAM_MAX_MS || "25000",
  10,
);
const V2_STREAM_MAX_MS =
  Number.isFinite(parsedV2StreamMaxMs) && parsedV2StreamMaxMs >= 5_000
    ? parsedV2StreamMaxMs
    : 25_000;

async function handleGet(request: Request, { params }: RouteContext) {
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

    await getWorkbenchSchemaCapabilities();
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
      if (executionRun && shouldRecoverLegacyRun(executionRun)) {
        await closeStaleWorkbenchRuns({
          executionRunId: executionRun.id,
          userId: user.id,
        });
        executionRun = await getExecutionRunForUser({
          executionRunId: executionRun.id,
          userId: user.id,
        });
      }

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

      if (executionRun?.runnerVersion === "v2") {
        const executionRunId = executionRun.id;
        const encoder = new TextEncoder();
        const session = executionRun.sessionId
          ? await prisma.workbenchSession.findFirst({
              where: { id: executionRun.sessionId, userId: user.id },
              select: { id: true, title: true, finalResultId: true },
            })
          : null;

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const send = (event: unknown) => {
              controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
            };

            const wait = (ms: number) =>
              new Promise((resolve) => setTimeout(resolve, ms));

            void (async () => {
              const seenStatuses = new Map<string, string>();
              const seenResults = new Set<string>();
              const streamStartedAt = Date.now();
              let lastRescueCheckAt = 0;
              let lastCursor: string | null = null;
              let unchangedPollCount = 0;

              if (session) {
                send({
                  type: "session",
                  session: {
                    id: session.id,
                    title: session.title,
                    finalResultId: session.finalResultId,
                  },
                });
              }

              while (!request.signal.aborted) {
                if (Date.now() - lastRescueCheckAt > 10_000) {
                  lastRescueCheckAt = Date.now();
                  await rescueStalledExecutionRunV2({
                    executionRunId,
                  }).catch(() => undefined);
                }

                const cursor = await getRunStreamCursor({
                  executionRunId,
                  userId: user.id,
                });
                if (!cursor) {
                  send({ type: "error", error: "Run not found." });
                  break;
                }

                if (cursor.value === lastCursor) {
                  unchangedPollCount += 1;
                  if (Date.now() - streamStartedAt >= V2_STREAM_MAX_MS) {
                    break;
                  }
                  await wait(getRunStreamPollDelayMs(unchangedPollCount));
                  continue;
                }

                lastCursor = cursor.value;
                unchangedPollCount = 0;

                const snapshot = await getExecutionRunStatusSnapshot({
                  executionRunId,
                  userId: user.id,
                });

                if (!snapshot) {
                  send({ type: "error", error: "Run not found." });
                  break;
                }

                send({
                  type: "run_plan",
                  executionRun: snapshot.executionRun,
                  runSteps: snapshot.runSteps,
                });

                for (const step of snapshot.runSteps) {
                  const previousStatus = seenStatuses.get(step.id);
                  if (previousStatus === step.status) {
                    continue;
                  }

                  seenStatuses.set(step.id, step.status);
                  send({
                    type: `step_${step.status}`,
                    step,
                  });
                  send({
                    type: "progress",
                    index: step.orderIndex - 1,
                    status:
                      step.status === "running" || step.status === "retrying"
                        ? "active"
                        : step.status,
                    title: `${step.targetProvider} / ${step.targetModel}`,
                    subtitle: `Step ${step.orderIndex} - ${step.actionType}`,
                    detail: step.errorMessage || step.promptSnapshotPreview || step.sourceTextSnapshotPreview,
                  });

                  if (step.result?.id && !seenResults.has(step.result.id)) {
                    seenResults.add(step.result.id);
                    const fullResult = await prisma.result.findUnique({
                      where: { id: step.result.id },
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
                    });
                    if (fullResult) {
                      send({
                        type: "result",
                        index: step.orderIndex - 1,
                        result: fullResult,
                      });
                    }
                  }
                }

                if (
                  ["completed", "partial", "failed", "canceled"].includes(
                    snapshot.executionRun.status,
                  )
                ) {
                  const results = await prisma.result.findMany({
                    where: { executionRunId },
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
                  });

                  send({
                    type: `run_${snapshot.executionRun.status}`,
                    executionRun: snapshot.executionRun,
                  });
                  send({
                    type: "done",
                    session: session
                      ? {
                          id: session.id,
                          title: session.title,
                          finalResultId: snapshot.executionRun.finalResultId,
                        }
                      : undefined,
                    results,
                    executionSummary: {
                      plannedTotal: snapshot.executionRun.totalStepsPlanned,
                      executedTotal:
                        snapshot.executionRun.totalStepsDone +
                        snapshot.executionRun.totalStepsFailed +
                        snapshot.executionRun.totalStepsCanceled,
                      stoppedEarly:
                        snapshot.executionRun.status === "partial" ||
                        snapshot.executionRun.status === "failed" ||
                        snapshot.executionRun.status === "canceled",
                      stopReason:
                        snapshot.executionRun.status === "canceled"
                          ? "canceled"
                          : snapshot.executionRun.status === "failed"
                            ? "failed"
                            : snapshot.executionRun.status === "partial"
                              ? "partial"
                              : null,
                    },
                  });
                  break;
                }

                if (Date.now() - streamStartedAt >= V2_STREAM_MAX_MS) {
                  break;
                }

                await wait(getRunStreamPollDelayMs(unchangedPollCount));
              }

              controller.close();
            })().catch((error) => {
              send({
                type: "error",
                error: error instanceof Error ? error.message : "Run stream failed.",
              });
              controller.close();
            });
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "application/x-ndjson; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
          },
        });
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

export async function GET(request: Request, context: RouteContext) {
  const timing = createServerTiming();
  const response = await timing.measure("run_stream_setup", () =>
    handleGet(request, context),
  );
  timing.apply(response.headers);
  return response;
}
