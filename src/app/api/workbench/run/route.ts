import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { Prisma } from "@prisma/client";
import {
  apiErrorResponse,
  consumeTrialConversation,
  requireApiGenerationUser,
} from "@/lib/api-auth";
import { assertProvidersReadyForRun } from "@/lib/provider-availability";
import {
  requireUsageAccess,
} from "@/lib/usage-policy";
import {
  assignWorkflowRunToExecutionRun,
  calculatePlannedExecutionTotal,
  createQueuedExecutionRun,
  createSignedRunToken,
  failExecutionRun,
} from "@/lib/execution-runs";
import { buildExecutionRunStepPlan } from "@/lib/execution-run-steps";
import { prisma } from "@/lib/prisma";
import {
  enqueueExecutionRunStep,
  enqueueWorkbenchWatchdog,
  getSequentialRunnerReadiness,
} from "@/lib/qstash";
import { runWorkbenchSchema } from "@/lib/validation";
import { ensureWorkbenchRunSchema } from "@/lib/workbench-run-schema";
import { closeStaleWorkbenchRuns } from "@/lib/workbench-run-watchdog";
import { selectWorkbenchRunnerVersion } from "@/lib/workbench-runner-version";
import { syncWorkflowTemplateSteps } from "@/lib/workflow-templates";
import type { ProviderName } from "@/lib/ai/types";
import { upsertWorkbenchSession } from "@/lib/ai/workflow";
import { workbenchRunWorkflow } from "@/workflows/workbench-run";
import { releaseUsageReservation, reserveUsage } from "@/lib/usage-policy";

export async function POST(request: Request) {
  let userId = "";
  let reservationId: string | null = null;
  let executionRunId: string | null = null;

  try {
    const user = await requireApiGenerationUser();
    userId = user.id;
    const parsed = runWorkbenchSchema.safeParse(await request.json());
    const inputCharCount =
      (parsed.success ? parsed.data.originalInput.length : 0) +
      (parsed.success ? parsed.data.additionalInstruction?.length ?? 0 : 0);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid run request." },
        { status: 400 },
      );
    }

    await ensureWorkbenchRunSchema();
    await closeStaleWorkbenchRuns({ userId: user.id });

    const usageContext = user.isTrial
      ? null
      : await requireUsageAccess({
          userId: user.id,
          inputCharCount,
        });

    if (parsed.data.mode === "parallel") {
      if (!parsed.data.targets?.length) {
        return NextResponse.json(
          { error: "Select at least one target model." },
          { status: 400 },
        );
      }

      const providerError = await assertProvidersReadyForRun(
        parsed.data.targets.map((target) => target.provider as ProviderName),
        user.id,
      );
      if (providerError) {
        return NextResponse.json({ error: providerError }, { status: 400 });
      }
    } else {
      if (!parsed.data.steps?.length) {
        return NextResponse.json(
          { error: "Add at least one workflow step." },
          { status: 400 },
        );
      }

      const providerError = await assertProvidersReadyForRun(
        parsed.data.steps.map((step) => step.targetProvider as ProviderName),
        user.id,
      );
      if (providerError) {
        return NextResponse.json({ error: providerError }, { status: 400 });
      }
    }

    if (user.isTrial) {
      await consumeTrialConversation(user);
    }

    const plannedTotal = calculatePlannedExecutionTotal(parsed.data);
    const preparedSession = await upsertWorkbenchSession(user.id, {
      ...parsed.data,
      workflowControl: parsed.data.workflowControl,
      workflowTemplateSteps:
        parsed.data.mode === "sequential"
          ? parsed.data.steps?.map((step) => ({
              ...step,
              targetProvider: step.targetProvider as ProviderName,
            }))
          : undefined,
      mode: parsed.data.mode,
    });
    const runnerVersion =
      parsed.data.mode === "sequential"
        ? selectWorkbenchRunnerVersion(user.id)
        : "v1";
    const runSession = {
      ...parsed.data,
      sessionId: preparedSession.id,
    };
    const reservation = user.isTrial
      ? null
      : await reserveUsage({
          userId: user.id,
          requestType: parsed.data.mode === "parallel" ? "compare" : "sequential",
          inputCharCount,
          reservationKey: `run:${crypto.randomUUID()}`,
          context: usageContext ?? undefined,
    });
    reservationId = reservation?.id ?? null;

    if (parsed.data.mode === "sequential" && runnerVersion === "v2") {
      const runnerReadiness = getSequentialRunnerReadiness();
      if (!runnerReadiness.ok) {
        return NextResponse.json(
          { error: runnerReadiness.message ?? "The V2 sequential runner is not ready." },
          { status: 503 },
        );
      }

      const executionRun = await prisma.$transaction(
        async (tx) => {
          const activeCount = await tx.executionRun.count({
            where: {
              userId: user.id,
              status: { in: ["queued", "running", "retrying", "canceling"] },
            },
          });

          const maxActiveRuns = Number.parseInt(
            process.env.WORKBENCH_MAX_ACTIVE_RUNS_PER_USER || "3",
            10,
          );
          if (activeCount >= maxActiveRuns) {
            throw new Error(
              `You already have ${activeCount} active AI runs. Wait for one to finish before starting another.`,
            );
          }

          const sessionActiveRun = await tx.executionRun.findFirst({
            where: {
              userId: user.id,
              sessionId: preparedSession.id,
              status: { in: ["queued", "running", "retrying", "canceling"] },
            },
            select: { id: true },
          });

          if (sessionActiveRun) {
            throw new Error(
              "This workbench session is already running. Wait for it to finish or resume the active run.",
            );
          }

          const templateSteps = await syncWorkflowTemplateSteps(tx, {
            sessionId: preparedSession.id,
            steps:
              parsed.data.steps?.map((step) => ({
                ...step,
                targetProvider: step.targetProvider as ProviderName,
              })) ?? [],
          });

          const createdRun = await tx.executionRun.create({
            data: {
              userId: user.id,
              sessionId: preparedSession.id,
              runnerVersion: "v2",
              mode: parsed.data.mode,
              requestType: "sequential",
              status: "queued",
              inputCharCount,
              totalStepsPlanned: plannedTotal,
              usageReservationId: reservation?.id ?? null,
            },
          });

          const templateStepIdsByIndex = new Map(
            templateSteps.map((step) => [step.orderIndex, step.id]),
          );
          const stepPlan = buildExecutionRunStepPlan({
            executionRunId: createdRun.id,
            sessionId: preparedSession.id,
            templateSteps:
              parsed.data.steps?.map((step) => ({
                ...step,
                targetProvider: step.targetProvider as ProviderName,
              })) ?? [],
            workflowControl: parsed.data.workflowControl,
            templateStepIdsByIndex,
          });

          await tx.executionRunStep.createMany({
            data: stepPlan.map((step) => ({
              executionRunId: createdRun.id,
              sessionId: preparedSession.id,
              orderIndex: step.orderIndex,
              stepKey: step.stepKey,
              attemptKey: null,
              templateStepIndex: step.templateStepIndex,
              templateStepId: step.templateStepId,
              actionType: step.actionType,
              targetProvider: step.targetProvider,
              targetModel: step.targetModel,
              sourceMode: step.sourceMode,
              sourceResultId: step.sourceResultId,
              instructionTemplate: step.instructionTemplate,
              repeatBlockIndex: step.repeatBlockIndex,
              repeatIteration: step.repeatIteration,
              repeatRangeStart: step.repeatRangeStart,
              repeatRangeEnd: step.repeatRangeEnd,
              status: "queued",
              queuedAt: new Date(),
            })),
          });

          return {
            executionRun: createdRun,
            firstStepOrderIndex: stepPlan[0]?.orderIndex ?? null,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      executionRunId = executionRun.executionRun.id;
      const firstStep = await prisma.executionRunStep.findFirst({
        where: {
          executionRunId: executionRun.executionRun.id,
          orderIndex: executionRun.firstStepOrderIndex ?? 1,
        },
        select: { id: true },
      });

      if (!firstStep) {
        throw new Error("The sequential execution plan could not be created.");
      }

      try {
        await enqueueExecutionRunStep(firstStep.id);
        await enqueueWorkbenchWatchdog(60).catch(() => undefined);
      } catch (error) {
        if (reservation?.id) {
          await releaseUsageReservation({
            reservationId: reservation.id,
            userId: user.id,
          }).catch(() => undefined);
        }
        await failExecutionRun({
          executionRunId: executionRun.executionRun.id,
          errorMessage:
            error instanceof Error
              ? error.message
              : "The V2 sequential runner could not queue the first step.",
        }).catch(() => undefined);
        throw error;
      }

      const signedRunId = createSignedRunToken({
        executionRunId: executionRun.executionRun.id,
        userId: user.id,
        mode: parsed.data.mode,
        createdAt: new Date().toISOString(),
      });

      return NextResponse.json({
        ok: true,
        runId: signedRunId,
        status: "queued",
        plannedTotal,
        runnerVersion: "v2",
        streamUrl: `/api/workbench/runs/${encodeURIComponent(signedRunId)}/stream`,
        statusUrl: `/api/workbench/runs/${encodeURIComponent(signedRunId)}`,
      });
    }

    const executionRun = await createQueuedExecutionRun({
      userId: user.id,
      sessionId: preparedSession.id,
      mode: parsed.data.mode,
      requestType: parsed.data.mode === "parallel" ? "compare" : "sequential",
      inputCharCount,
      totalStepsPlanned: plannedTotal,
      usageReservationId: reservation?.id ?? null,
      runnerVersion,
    });
    executionRunId = executionRun.id;

    let workflowRun;

    try {
      workflowRun = await start(workbenchRunWorkflow, [
        {
          executionRunId: executionRun.id,
          usageReservationId: reservation?.id ?? null,
          userId: user.id,
          inputCharCount,
          requestType: parsed.data.mode === "parallel" ? "compare" : "sequential",
          session: runSession,
        },
      ]);
    } catch (error) {
      if (reservation) {
        await releaseUsageReservation({
          reservationId: reservation.id,
          userId: user.id,
        }).catch(() => undefined);
      }
      await failExecutionRun({
        executionRunId: executionRun.id,
        errorMessage:
          error instanceof Error
            ? error.message
            : "The durable AI run could not be started.",
      }).catch(() => undefined);
      throw error;
    }

    await assignWorkflowRunToExecutionRun({
      executionRunId: executionRun.id,
      workflowRunId: workflowRun.runId,
    });

    const signedRunId = createSignedRunToken({
      executionRunId: executionRun.id,
      userId: user.id,
      mode: parsed.data.mode,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      runId: signedRunId,
      status: "queued",
      plannedTotal,
      streamUrl: `/api/workbench/runs/${encodeURIComponent(signedRunId)}/stream`,
      statusUrl: `/api/workbench/runs/${encodeURIComponent(signedRunId)}`,
    });
  } catch (error) {
    if (reservationId && userId && !executionRunId) {
      await releaseUsageReservation({
        reservationId,
        userId,
      }).catch(() => undefined);
    }
    return apiErrorResponse(error);
  }
}
