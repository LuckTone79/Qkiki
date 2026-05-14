import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { ensureWorkflowControlJsonColumn } from "@/lib/workbench-session-schema";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const supportsWorkflowControl = await ensureWorkflowControlJsonColumn();
    const session = await prisma.workbenchSession.findFirst({
      where: { id, userId: user.id },
      select: {
        id: true,
        projectId: true,
        title: true,
        originalInput: true,
        originalInputCiphertext: true,
        originalInputIv: true,
        originalInputTag: true,
        additionalInstruction: true,
        outputStyle: true,
        outputLanguage: true,
        mode: true,
        finalResultId: true,
        ...(supportsWorkflowControl ? { workflowControlJson: true } : {}),
        workflowSteps: { orderBy: { orderIndex: "asc" } },
        results: { orderBy: { createdAt: "asc" } },
        attachments: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const copy = await prisma.workbenchSession.create({
      data: {
        userId: user.id,
        projectId: session.projectId,
        title: `Copy of ${session.title}`,
        originalInput: session.originalInput,
        originalInputCiphertext: session.originalInputCiphertext,
        originalInputIv: session.originalInputIv,
        originalInputTag: session.originalInputTag,
        additionalInstruction: session.additionalInstruction,
        outputStyle: session.outputStyle,
        outputLanguage: session.outputLanguage,
        mode: session.mode,
        ...(supportsWorkflowControl
          ? {
              workflowControlJson:
                (session as { workflowControlJson?: string | null }).workflowControlJson ?? null,
            }
          : {}),
      },
    });

    const stepIdMap = new Map<string, string>();
    for (const step of session.workflowSteps) {
      const created = await prisma.workflowStep.create({
        data: {
          sessionId: copy.id,
          orderIndex: step.orderIndex,
          actionType: step.actionType,
          targetProvider: step.targetProvider,
          targetModel: step.targetModel,
          sourceMode: step.sourceMode,
          sourceResultId: step.sourceResultId,
          instructionTemplate: step.instructionTemplate,
        },
      });
      stepIdMap.set(step.id, created.id);
    }

    const attachmentIdMap = new Map<string, string>();
    for (const attachment of session.attachments) {
      const created = await prisma.sessionAttachment.create({
        data: {
          userId: user.id,
          sessionId: copy.id,
          name: attachment.name,
          mimeType: attachment.mimeType,
          kind: attachment.kind,
          sizeBytes: attachment.sizeBytes,
          storagePath: attachment.storagePath,
          extractedText: attachment.extractedText,
          dataBase64: attachment.dataBase64,
        },
      });
      attachmentIdMap.set(attachment.id, created.id);
    }

    const resultIdMap = new Map<string, string>();
    for (const result of session.results) {
      const created = await prisma.result.create({
        data: {
          sessionId: copy.id,
          workflowStepId: result.workflowStepId
            ? stepIdMap.get(result.workflowStepId) || null
            : null,
          parentResultId: result.parentResultId
            ? resultIdMap.get(result.parentResultId) || null
            : null,
          branchKey: result.branchKey,
          provider: result.provider,
          model: result.model,
          promptSnapshot: result.promptSnapshot,
          outputText: result.outputText,
          outputTextCiphertext: result.outputTextCiphertext,
          outputTextIv: result.outputTextIv,
          outputTextTag: result.outputTextTag,
          rawResponse: result.rawResponse,
          status: result.status,
          errorMessage: result.errorMessage,
          tokenUsagePrompt: result.tokenUsagePrompt,
          tokenUsageCompletion: result.tokenUsageCompletion,
          estimatedCost: result.estimatedCost,
          costIsEstimated: result.costIsEstimated,
          latencyMs: result.latencyMs,
        },
      });
      resultIdMap.set(result.id, created.id);

      const links = await prisma.resultAttachment.findMany({
        where: { resultId: result.id },
        select: { attachmentId: true },
      });

      if (links.length) {
        await prisma.resultAttachment.createMany({
          data: links
            .map((link) => attachmentIdMap.get(link.attachmentId))
            .filter((attachmentId): attachmentId is string => Boolean(attachmentId))
            .map((attachmentId) => ({
              resultId: created.id,
              attachmentId,
            })),
        });
      }
    }

    for (const step of session.workflowSteps) {
      if (step.sourceResultId && stepIdMap.has(step.id)) {
        await prisma.workflowStep.update({
          where: { id: stepIdMap.get(step.id) },
          data: {
            sourceResultId: resultIdMap.get(step.sourceResultId) || null,
          },
        });
      }
    }

    if (session.finalResultId) {
      await prisma.workbenchSession.update({
        where: { id: copy.id },
        data: { finalResultId: resultIdMap.get(session.finalResultId) || null },
      });
    }

    return NextResponse.json({ session: copy });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
