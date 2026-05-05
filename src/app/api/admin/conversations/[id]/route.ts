import { NextResponse } from "next/server";
import {
  adminApiErrorResponse,
  getRequestMeta,
  requireApiAdminViewer,
} from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireApiAdminViewer();
    const { id } = await context.params;
    const meta = getRequestMeta(request);

    const session = await prisma.workbenchSession.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        workflowSteps: {
          orderBy: { orderIndex: "asc" },
        },
        results: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            provider: true,
            model: true,
            status: true,
            errorMessage: true,
            createdAt: true,
            updatedAt: true,
            tokenUsagePrompt: true,
            tokenUsageCompletion: true,
            estimatedCost: true,
            costIsEstimated: true,
            latencyMs: true,
            branchKey: true,
            parentResultId: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    await prisma.adminContentAccessLog.create({
      data: {
        adminUserId: admin.id,
        viewedUserId: session.userId,
        conversationId: session.id,
        accessReasonCode: "detail_open",
      },
    });

    return NextResponse.json({
      conversation: {
        id: session.id,
        userId: session.userId,
        user: session.user,
        title: session.title,
        mode: session.mode,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        originalInputPreview: session.originalInput.slice(0, 220),
        workflowSteps: session.workflowSteps,
        results: session.results,
        _meta: {
          ipAddress: meta.ipAddress,
        },
      },
    });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
