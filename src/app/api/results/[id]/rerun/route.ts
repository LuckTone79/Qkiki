import { NextResponse } from "next/server";
import {
  apiErrorResponse,
  consumeTrialConversation,
  requireApiGenerationUser,
} from "@/lib/api-auth";
import { executeAndPersistResult } from "@/lib/ai/workflow";
import { isProviderName } from "@/lib/ai/provider-catalog";
import { hydrateRuntimeAttachments } from "@/lib/attachments";
import { assertProvidersReadyForRun } from "@/lib/provider-availability";
import { prisma } from "@/lib/prisma";
import {
  recordUsageSuccess,
  requireUsageAccess,
} from "@/lib/usage-policy";

export const maxDuration = 300;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiGenerationUser();
    const usageContext = user.isTrial
      ? null
      : await requireUsageAccess({
          userId: user.id,
          inputCharCount: 0,
        });
    const { id } = await context.params;
    const result = await prisma.result.findFirst({
      where: { id, session: { userId: user.id } },
      include: {
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

    const usage = user.isTrial
      ? undefined
      : await recordUsageSuccess({
          userId: user.id,
          requestType: "rerun",
          selectedModels: [`${rerun.provider}/${rerun.model}`],
          inputCharCount: 0,
          inputTokenCount: rerun.tokenUsagePrompt ?? 0,
          outputTokenCount: rerun.tokenUsageCompletion ?? 0,
          estimatedCostUsd: rerun.estimatedCost ?? 0,
          context: usageContext ?? undefined,
        });

    return NextResponse.json({ result: rerun, usage });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
