import { AdminConversationsClient } from "@/components/admin/AdminConversationsClient";
import { buildConversationUsageSummaries } from "@/lib/admin-usage-metrics";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; userId?: string }>;
}) {
  const { q: qRaw, userId: userIdRaw } = await searchParams;
  const q = qRaw?.trim() || "";
  const userId = userIdRaw?.trim() || "";

  const where =
    q || userId
      ? {
          AND: [
            ...(q
              ? [
                  {
                    OR: [
                      { title: { contains: q } },
                      { user: { email: { contains: q } } },
                      { user: { name: { contains: q } } },
                    ],
                  },
                ]
              : []),
            ...(userId ? [{ userId }] : []),
          ],
        }
      : undefined;

  const conversations = await prisma.workbenchSession.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 120,
    select: {
      id: true,
      title: true,
      mode: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      _count: {
        select: {
          results: true,
          workflowSteps: true,
        },
      },
    },
  });
  const conversationIds = conversations.map((conversation) => conversation.id);
  const [resultUsageRows, requestOnlyUsageRows] = conversationIds.length
    ? await Promise.all([
        prisma.result.findMany({
          where: { sessionId: { in: conversationIds } },
          select: {
            sessionId: true,
            estimatedCost: true,
            tokenUsagePrompt: true,
            tokenUsageCompletion: true,
          },
        }),
        prisma.aiRequest.findMany({
          where: {
            conversationId: { in: conversationIds },
            messageId: null,
          },
          select: {
            conversationId: true,
            messageId: true,
            estimatedCostUsd: true,
            inputTokens: true,
            outputTokens: true,
          },
        }),
      ])
    : [[], []];
  const usageSummaries = buildConversationUsageSummaries({
    results: resultUsageRows.map((result) => ({
      sessionId: result.sessionId,
      estimatedCost: result.estimatedCost ?? null,
      tokenUsagePrompt: result.tokenUsagePrompt,
      tokenUsageCompletion: result.tokenUsageCompletion,
    })),
    aiRequests: requestOnlyUsageRows.map((request) => ({
      conversationId: request.conversationId,
      messageId: request.messageId,
      estimatedCostUsd: request.estimatedCostUsd ?? null,
      inputTokens: request.inputTokens,
      outputTokens: request.outputTokens,
    })),
  });

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      _count: {
        select: {
          sessions: true,
        },
      },
    },
  });

  return (
    <AdminConversationsClient
      q={q}
      userId={userId}
      users={users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        conversationCount: user._count.sessions,
      }))}
      conversations={conversations.map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        mode: conversation.mode,
        updatedAt: conversation.updatedAt.toISOString(),
        user: {
          id: conversation.user.id,
          email: conversation.user.email,
          name: conversation.user.name,
        },
        counts: {
          workflowSteps: conversation._count.workflowSteps,
          results: conversation._count.results,
        },
        usage: usageSummaries.get(conversation.id) ?? {
          totalCreditsUsed: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalEstimatedCostUsd: 0,
        },
      }))}
    />
  );
}
