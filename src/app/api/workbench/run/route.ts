import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { start } from "workflow/api";
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
import { runWorkbenchSchema } from "@/lib/validation";
import { closeStaleWorkbenchRuns } from "@/lib/workbench-run-watchdog";
import type { ProviderName } from "@/lib/ai/types";
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
    const executionRun = await createQueuedExecutionRun({
      userId: user.id,
      sessionId: parsed.data.sessionId ?? null,
      mode: parsed.data.mode,
      requestType: parsed.data.mode === "parallel" ? "compare" : "sequential",
      inputCharCount,
      totalStepsPlanned: plannedTotal,
      usageReservationId: reservation?.id ?? null,
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
          session: parsed.data,
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
