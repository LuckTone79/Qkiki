import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { apiErrorResponse, requireApiGenerationUser } from "@/lib/api-auth";
import { createSignedRunToken, readSignedRunToken } from "@/lib/execution-runs";
import { prisma } from "@/lib/prisma";
import { enqueueExecutionRunStep, enqueueWorkbenchWatchdog } from "@/lib/qstash";
import { releaseUsageReservation, requireUsageAccess, reserveUsage } from "@/lib/usage-policy";

type RouteContext = {
  params: Promise<{ runId: string; orderIndex: string }>;
};

export async function POST(_request: Request, { params }: RouteContext) {
  let userId = "";
  let reservationId: string | null = null;

  try {
    const user = await requireApiGenerationUser();
    userId = user.id;
    const { runId, orderIndex: rawOrderIndex } = await params;
    const branchFromOrderIndex = Number.parseInt(rawOrderIndex, 10);

    if (!Number.isInteger(branchFromOrderIndex) || branchFromOrderIndex < 1) {
      return NextResponse.json({ error: "Invalid order index." }, { status: 400 });
    }

    let token;
    try {
      token = readSignedRunToken(decodeURIComponent(runId));
    } catch {
      return NextResponse.json({ error: "Run not found." }, { status: 404 });
    }

    if (token.userId !== user.id || !("executionRunId" in token)) {
      return NextResponse.json({ error: "Run not found." }, { status: 404 });
    }

    const parentRun = await prisma.executionRun.findFirst({
      where: {
        id: token.executionRunId,
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

    if (!parentRun || !parentRun.session) {
      return NextResponse.json({ error: "Run not found." }, { status: 404 });
    }

    if (parentRun.runnerVersion !== "v2") {
      return NextResponse.json(
        { error: "Branch rerun is currently available for V2 sequential runs only." },
        { status: 409 },
      );
    }

    if (!parentRun.steps.length) {
      return NextResponse.json(
        { error: "No branchable steps were found from that execution point." },
        { status: 400 },
      );
    }

    const usageContext = await requireUsageAccess({
      userId: user.id,
      inputCharCount: parentRun.inputCharCount,
    });
    const reservation = await reserveUsage({
      userId: user.id,
      requestType: "sequential",
      inputCharCount: parentRun.inputCharCount,
      reservationKey: `branch-rerun:${crypto.randomUUID()}`,
      context: usageContext,
    });
    reservationId = reservation.id;

    const branchRun = await prisma.$transaction(
      async (tx) => {
        const createdRun = await tx.executionRun.create({
          data: {
            userId: user.id,
            sessionId: parentRun.sessionId,
            runnerVersion: "v2",
            parentExecutionRunId: parentRun.id,
            branchFromOrderIndex,
            branchReason: "branch_rerun",
            mode: "sequential",
            requestType: "sequential",
            status: "queued",
            inputCharCount: parentRun.inputCharCount,
            totalStepsPlanned: parentRun.steps.length,
            usageReservationId: reservation.id,
          },
        });

        await tx.executionRunStep.createMany({
          data: parentRun.steps.map((step) => ({
            executionRunId: createdRun.id,
            sessionId: step.sessionId,
            orderIndex: step.orderIndex,
            stepKey: `qkiki:run:${createdRun.id}:step:${step.orderIndex}`,
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

        return createdRun;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

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
      throw new Error("The branch rerun could not be prepared.");
    }

    await enqueueExecutionRunStep(firstStep.id);
    await enqueueWorkbenchWatchdog(60).catch(() => undefined);

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
  } catch (error) {
    if (reservationId) {
      await releaseUsageReservation({
        reservationId,
        userId,
      }).catch(() => undefined);
    }
    return apiErrorResponse(error);
  }
}
