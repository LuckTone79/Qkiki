import { NextResponse } from "next/server";
import {
  apiErrorResponse,
  consumeTrialConversation,
  requireApiGenerationUser,
} from "@/lib/api-auth";
import { executeBranchRun } from "@/lib/ai/workflow";
import { assertProvidersReadyForRun } from "@/lib/provider-availability";
import { branchRunSchema } from "@/lib/validation";
import type { ProviderName } from "@/lib/ai/types";

export async function POST(request: Request) {
  try {
    const user = await requireApiGenerationUser();
    const parsed = branchRunSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid branch request." },
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

    if (user.isTrial) {
      await consumeTrialConversation(user);
    }

    const result = await executeBranchRun({
      userId: user.id,
      parentResultId: parsed.data.parentResultId,
      actionType: parsed.data.actionType,
      instruction: parsed.data.instruction,
      targets: parsed.data.targets.map((target) => ({
        provider: target.provider as ProviderName,
        model: target.model,
      })),
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
