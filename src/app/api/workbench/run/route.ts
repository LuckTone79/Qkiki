import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import {
  executeParallelRun,
  executeSequentialRun,
} from "@/lib/ai/workflow";
import { assertProvidersReadyForRun } from "@/lib/provider-availability";
import { runWorkbenchSchema } from "@/lib/validation";
import type { ProviderName } from "@/lib/ai/types";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const parsed = runWorkbenchSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid run request." },
        { status: 400 },
      );
    }

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

      const result = await executeParallelRun({
        userId: user.id,
        session: parsed.data,
        targets: parsed.data.targets.map((target) => ({
          provider: target.provider as ProviderName,
          model: target.model,
        })),
      });

      return NextResponse.json(result);
    }

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

    const result = await executeSequentialRun({
      userId: user.id,
      session: parsed.data,
      steps: parsed.data.steps.map((step) => ({
        ...step,
        targetProvider: step.targetProvider as ProviderName,
      })),
      workflowControl: parsed.data.workflowControl
        ? {
            repeat: parsed.data.workflowControl.repeat
              ? {
                  enabled: parsed.data.workflowControl.repeat.enabled,
                  startStepOrder:
                    parsed.data.workflowControl.repeat.startStepOrder,
                  endStepOrder: parsed.data.workflowControl.repeat.endStepOrder,
                  repeatCount: parsed.data.workflowControl.repeat.repeatCount,
                }
              : undefined,
            stopCondition: parsed.data.workflowControl.stopCondition
              ? {
                  enabled: parsed.data.workflowControl.stopCondition.enabled,
                  checkStepOrder:
                    parsed.data.workflowControl.stopCondition.checkStepOrder,
                  qualityThreshold:
                    parsed.data.workflowControl.stopCondition.qualityThreshold,
                }
              : undefined,
          }
        : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
