import { AdminConversationsClient } from "@/components/admin/AdminConversationsClient";
import { prisma } from "@/lib/prisma";

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
      }))}
    />
  );
}
