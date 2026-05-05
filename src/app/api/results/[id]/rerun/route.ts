import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { executeAndPersistResult } from "@/lib/ai/workflow";
import { isProviderName } from "@/lib/ai/provider-catalog";
import { hydrateRuntimeAttachments } from "@/lib/attachments";
import { assertProvidersReadyForRun } from "@/lib/provider-availability";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
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

    return NextResponse.json({ result: rerun });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
