import crypto from "node:crypto";
import { NextResponse } from "next/server";
import {
  apiErrorResponse,
  consumeTrialConversation,
  requireApiGenerationUser,
} from "@/lib/api-auth";
import { createSignedRunToken, failExecutionRun } from "@/lib/execution-runs";
import { executeAndPersistResult } from "@/lib/ai/workflow";
import { isProviderName } from "@/lib/ai/provider-catalog";
import { hydrateRuntimeAttachments } from "@/lib/attachments";
import {
  enqueueExecutionRunStep,
  enqueueWorkbenchWatchdog,
  getSequentialRunnerReadiness,
} from "@/lib/qstash";
import { assertProvidersReadyForRun } from "@/lib/provider-availability";
import { prisma } from "@/lib/prisma";
import { ensureResultExecutionRunIdColumn } from "@/lib/workbench-run-schema";
import {
  releaseUsageReservation,
  requireUsageAccess,
  reserveUsage,
  settleUsageReservation,
} from "@/lib/usage-policy";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let userId = "";
  let executionFinished = false;
  let reservedUsage:
    | {
        id: string;
      }
    | null = null;
  let branchRunId: string | null = null;

  try {
    const user = await requireApiGenerationUser();
    userId = user.id;
    const usageContext = user.isTrial
      ? null
      : await requireUsageAccess({
          userId: user.id,
          inputCharCount: 0,
        });
    const { id } = await context.params;
    await ensureResultExecutionRunIdColumn();
    const result = await prisma.result.findFirst({
      where: { id, session: { userId: user.id } },
      include: {
        executionRun: true,
        executionRunStep: {
          select: {
            orderIndex: true,
          },
        },
        attachmentLinks: {
          include: { attachment: true },
        },
      },
    });

    if (!result) {
      return NextResponse.json({ error: "Result not found." }, { status: 404 });
    }

    if (!isProviderName(result.provider)) {
      return NextResponse.json(
        { error: "Result has an unsupported provider." },
        { status: 400 },
      );
    }

    const providerError = await assertProvidersReadyForRun(
      [result.provider],
      user.id,
    );
    if (providerError) {
      return NextResponse.json({ error: providerError }, { status: 400 });
    }

    if (user.isTrial) {
      await consumeTrialConversation(user);
    }

    if (
      result.executionRun?.runnerVersion === "v2" &&
      result.executionRunStep?.orderIndex &&
      result.executionRun.sessionId
    ) {
      const runnerReadiness = getSequentialRunnerReadiness();
      if (!runnerReadiness.ok) {
        return NextResponse.json(
          { error: runnerReadiness.message ?? "The V2 sequential runner is not ready." },
          { status: 503 },
        );
      }

      const branchFromOrderIndex = result.executionRunStep.orderIndex;
      const parentRun = await prisma.executionRun.findFirst({
        where: {
          id: result.executionRun.id,
          userId: user.id,
        },
        include: {
          session: true,
          steps: {
            where: {
              orderIndex: { gte: branchFromOrderIndex },
            },
            orderBy: {
              orderIndex: "asc",
            },
          },
        },
      });

      if (!parentRun || !parentRun.session || !parentRun.steps.length) {
        return NextResponse.json(
          { error: "The sequential rerun could not be prepared." },
          { status: 400 },
        );
      }

      reservedUsage = user.isTrial
        ? null
        : await reserveUsage({
            userId: user.id,
            requestType: "sequential",
            inputCharCount: parentRun.inputCharCount,
            reservationKey: `rerun-branch:${crypto.randomUUID()}`,
            context: usageContext ?? undefined,
          });

      const branchRun = await prisma.executionRun.create({
        data: {
          userId: user.id,
          sessionId: parentRun.sessionId,
          runnerVersion: "v2",
          parentExecutionRunId: parentRun.id,
          branchFromOrderIndex,
          branchReason: "result_rerun",
          mode: "sequential",
          requestType: "sequential",
          status: "queued",
          inputCharCount: parentRun.inputCharCount,
          totalStepsPlanned: parentRun.steps.length,
          usageReservationId: reservedUsage?.id ?? null,
        },
      });
      branchRunId = branchRun.id;

      await prisma.executionRunStep.createMany({
        data: parentRun.steps.map((step) => ({
          executionRunId: branchRun.id,
          sessionId: step.sessionId,
          orderIndex: step.orderIndex,
          stepKey: `qkiki:run:${branchRun.id}:step:${step.orderIndex}`,
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

      const firstStep = await prisma.executionRunStep.findFirst({
        where: {
          executionRunId: branchRun.id,
        },
        orderBy: {
          orderIndex: "asc",
        },
        select: { id: true },
      });

      if (!firstStep) {
        throw new Error("The sequential rerun could not be prepared.");
      }

      try {
        await enqueueExecutionRunStep(firstStep.id);
        await enqueueWorkbenchWatchdog(60).catch(() => undefined);
      } catch (error) {
        if (reservedUsage && userId) {
          await releaseUsageReservation({
            reservationId: reservedUsage.id,
            userId,
          }).catch(() => undefined);
        }
        await failExecutionRun({
          executionRunId: branchRun.id,
          errorMessage:
            error instanceof Error
              ? error.message
              : "The V2 rerun could not queue the first step.",
        }).catch(() => undefined);
        throw error;
      }

      const signedRunId = createSignedRunToken({
        executionRunId: branchRun.id,
        userId: user.id,
        mode: "sequential",
        createdAt: new Date().toISOString(),
      });

      return NextResponse.json({
        ok: true,
        runId: signedRunId,
        executionRunId: branchRun.id,
        status: "queued",
        statusUrl: `/api/workbench/runs/${encodeURIComponent(signedRunId)}`,
        streamUrl: `/api/workbench/runs/${encodeURIComponent(signedRunId)}/stream`,
      });
    }

    reservedUsage = user.isTrial
      ? null
      : await reserveUsage({
          userId: user.id,
          requestType: "rerun",
          inputCharCount: 0,
          reservationKey: `rerun:${crypto.randomUUID()}`,
          context: usageContext ?? undefined,
        });

    const rerun = await executeAndPersistResult({
      userId: user.id,
      sessionId: result.sessionId,
      workflowStepId: result.workflowStepId,
      parentResultId: result.parentResultId,
      branchKey: `rerun-${Date.now()}`,
      provider: result.provider,
      model: result.model,
      requestType: "rerun",
      prompt: result.promptSnapshot,
      attachments: await hydrateRuntimeAttachments(
        result.attachmentLinks.map((link) => link.attachment),
      ),
    });
    executionFinished = true;

    const usage = user.isTrial
      ? undefined
      : await settleUsageReservation({
          reservationId: reservedUsage?.id,
          userId: user.id,
          requestType: "rerun",
          selectedModels: [`${rerun.provider}/${rerun.model}`],
          inputCharCount: 0,
          inputTokenCount: rerun.tokenUsagePrompt ?? 0,
          outputTokenCount: rerun.tokenUsageCompletion ?? 0,
          estimatedCostUsd: rerun.estimatedCost ?? 0,
        });

    return NextResponse.json({ result: rerun, usage });
  } catch (error) {
    if (reservedUsage && userId && !executionFinished && !branchRunId) {
      await releaseUsageReservation({
        reservationId: reservedUsage.id,
        userId,
      }).catch(() => undefined);
    }
    return apiErrorResponse(error);
  }
}
