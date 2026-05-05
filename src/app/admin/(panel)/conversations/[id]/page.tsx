import { notFound } from "next/navigation";
import { requireAdminViewer } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  AdminConversationDetailClient,
  type ConversationDetailData,
} from "@/components/admin/AdminConversationDetailClient";

export const dynamic = "force-dynamic";

export default async function AdminConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdminViewer();
  const { id } = await params;

  const conversation = await prisma.workbenchSession.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, name: true } },
      workflowSteps: { orderBy: { orderIndex: "asc" } },
      results: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          provider: true,
          model: true,
          status: true,
          errorMessage: true,
          tokenUsagePrompt: true,
          tokenUsageCompletion: true,
          estimatedCost: true,
          costIsEstimated: true,
          latencyMs: true,
          createdAt: true,
        },
      },
    },
  });

  if (!conversation) notFound();

  await prisma.adminContentAccessLog.create({
    data: {
      adminUserId: admin.id,
      viewedUserId: conversation.userId,
      conversationId: conversation.id,
      accessReasonCode: "detail_open",
    },
  });

  const data: ConversationDetailData = {
    id: conversation.id,
    title: conversation.title ?? "",
    updatedAt: conversation.updatedAt.toISOString(),
    userName: conversation.user.name || conversation.user.email,
    userEmail: conversation.user.email,
    workflowSteps: conversation.workflowSteps.map((step) => ({
      id: step.id,
      orderIndex: step.orderIndex,
      actionType: step.actionType,
      targetProvider: step.targetProvider,
      targetModel: step.targetModel,
      sourceMode: step.sourceMode,
    })),
    results: conversation.results.map((result) => ({
      id: result.id,
      provider: result.provider,
      model: result.model,
      status: result.status,
      errorMessage: result.errorMessage,
      tokenUsagePrompt: result.tokenUsagePrompt,
      tokenUsageCompletion: result.tokenUsageCompletion,
      estimatedCost: result.estimatedCost ? Number(result.estimatedCost) : null,
      costIsEstimated: result.costIsEstimated,
      latencyMs: result.latencyMs,
    })),
  };

  return <AdminConversationDetailClient conversation={data} />;
}
