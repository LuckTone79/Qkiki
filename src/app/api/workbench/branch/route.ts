import crypto from "node:crypto";
import { NextResponse } from "next/server";
import {
  apiErrorResponse,
  consumeTrialConversation,
  requireApiGenerationUser,
} from "@/lib/api-auth";
import { executeBranchRun } from "@/lib/ai/workflow";
import { assertProvidersReadyForRun } from "@/lib/provider-availability";
import {
  releaseUsageReservation,
  requireUsageAccess,
  reserveUsage,
  settleUsageReservation,
} from "@/lib/usage-policy";
import { branchRunSchema } from "@/lib/validation";
import type { ProviderName } from "@/lib/ai/types";

export async function POST(request: Request) {
  let userId = "";
  let executionFinished = false;
  let reservedUsage:
    | {
        id: string;
      }
    | null = null;

  try {
    const user = await requireApiGenerationUser();
    userId = user.id;
    const parsed = branchRunSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid branch request." },
        { status: 400 },
      );
    }

    const usageContext = user.isTrial
      ? null
      : await requireUsageAccess({
          userId: user.id,
          inputCharCount: parsed.data.instruction.length,
        });

    const providerError = await assertProvidersReadyForRun(
      parsed.data.targets.map((target) => target.provider as ProviderName),
      user.id,
    );
    if (providerError) {
      return NextResponse.json({ error: providerError }, { status: 400 });
    }

    if (user.isTrial) {
      await consumeTrialConversation(user);
    }

    reservedUsage = user.isTrial
      ? null
      : await reserveUsage({
          userId: user.id,
          requestType: parsed.data.actionType,
          inputCharCount: parsed.data.instruction.length,
          reservationKey: `branch:${crypto.randomUUID()}`,
          context: usageContext ?? undefined,
        });

    const result = await executeBranchRun({
      userId: user.id,
      parentResultId: parsed.data.parentResultId,
      actionType: parsed.data.actionType,
      instruction: parsed.data.instruction,
      outputLanguage: parsed.data.outputLanguage,
      targets: parsed.data.targets.map((target) => ({
        provider: target.provider as ProviderName,
        model: target.model,
      })),
    });
    executionFinished = true;

    const usage = user.isTrial
      ? undefined
      : await settleUsageReservation({
          reservationId: reservedUsage?.id,
          userId: user.id,
          requestType: parsed.data.actionType,
          selectedModels: parsed.data.targets.map(
            (target) => `${target.provider}/${target.model}`,
          ),
          inputCharCount: parsed.data.instruction.length,
          inputTokenCount: (result.results || []).reduce(
            (sum, item) => sum + (item.tokenUsagePrompt ?? 0),
            0,
          ),
          outputTokenCount: (result.results || []).reduce(
            (sum, item) => sum + (item.tokenUsageCompletion ?? 0),
            0,
          ),
          estimatedCostUsd: (result.results || []).reduce(
            (sum, item) => sum + (item.estimatedCost ?? 0),
            0,
          ),
        });

    return NextResponse.json({ ...result, usage });
  } catch (error) {
    if (reservedUsage && userId && !executionFinished) {
      await releaseUsageReservation({
        reservationId: reservedUsage.id,
        userId,
      }).catch(() => undefined);
    }
    return apiErrorResponse(error);
  }
}
