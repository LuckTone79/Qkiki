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
  calculatePlannedExecutionTotal,
  createSignedRunToken,
  serializeUsageCheckContext,
} from "@/lib/execution-runs";
import { runWorkbenchSchema } from "@/lib/validation";
import type { ProviderName } from "@/lib/ai/types";
import { workbenchRunWorkflow } from "@/workflows/workbench-run";

export async function POST(request: Request) {
  try {
    const user = await requireApiGenerationUser();
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

    const workflowRun = await start(workbenchRunWorkflow, [
      {
        userId: user.id,
        inputCharCount,
        requestType: parsed.data.mode === "parallel" ? "compare" : "sequential",
        session: parsed.data,
        usageContext: usageContext
          ? serializeUsageCheckContext(usageContext)
          : null,
      },
    ]);
    const signedRunId = createSignedRunToken({
      workflowRunId: workflowRun.runId,
      userId: user.id,
      mode: parsed.data.mode,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      runId: signedRunId,
      status: "queued",
      plannedTotal: calculatePlannedExecutionTotal(parsed.data),
      streamUrl: `/api/workbench/runs/${encodeURIComponent(signedRunId)}/stream`,
      statusUrl: `/api/workbench/runs/${encodeURIComponent(signedRunId)}`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
