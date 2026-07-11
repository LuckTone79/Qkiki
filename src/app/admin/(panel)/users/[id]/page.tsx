import { notFound } from "next/navigation";
import { requireAdminViewer } from "@/lib/admin-auth";
import { canAdminMutateUser } from "@/lib/admin-authorization";
import { logAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import { AdminUserDetailClient, type UserDetailData } from "@/components/admin/AdminUserDetailClient";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdminViewer();
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      subscription: true,
      creditWallet: {
        select: { paidCredits: true, bonusCredits: true, totalUsedCredits: true },
      },
      sessions: {
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: {
          id: true,
          title: true,
          mode: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { results: true } },
        },
      },
      couponRedemptions: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          coupon: { select: { type: true } },
        },
      },
      aiRequests: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          requestType: true,
          provider: true,
          model: true,
          status: true,
          inputTokens: true,
          outputTokens: true,
          estimatedCostUsd: true,
          createdAt: true,
          conversation: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
  });

  if (!user) notFound();

  const [requestTotals, usageTotals, perConversationUsage] = await Promise.all([
    prisma.aiRequest.aggregate({
      where: { userId: user.id },
      _count: { _all: true },
      _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true },
    }),
    prisma.usageLog.aggregate({
      where: { userId: user.id },
      _sum: { creditsUsed: true },
    }),
    prisma.aiRequest.groupBy({
      by: ["conversationId"],
      where: { userId: user.id, conversationId: { not: null } },
      _count: { _all: true },
      _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true },
    }),
  ]);

  const conversationUsageMap = new Map(
    perConversationUsage.map((row) => [
      row.conversationId,
      {
        requests: row._count._all,
        inputTokens: row._sum.inputTokens ?? 0,
        outputTokens: row._sum.outputTokens ?? 0,
        estimatedCostUsd: row._sum.estimatedCostUsd ?? 0,
      },
    ]),
  );

  await logAdminAudit({
    adminUserId: admin.id,
    action: "USER_DETAIL_VIEW",
    targetType: "user",
    targetId: user.id,
  });

  const data: UserDetailData = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    canManageAccount: canAdminMutateUser(admin, user),
    createdAt: user.createdAt.toISOString(),
    lastActiveAt: (user.lastActiveAt ?? user.createdAt).toISOString(),
    totals: {
      totalRequests: requestTotals._count._all,
      inputTokens: requestTotals._sum.inputTokens ?? 0,
      outputTokens: requestTotals._sum.outputTokens ?? 0,
      estimatedCostUsd: requestTotals._sum.estimatedCostUsd ?? 0,
      creditsUsed: usageTotals._sum.creditsUsed ?? 0,
      totalConversations: user.sessions.length,
    },
    creditWallet: user.creditWallet
      ? {
          paidCredits: user.creditWallet.paidCredits,
          bonusCredits: user.creditWallet.bonusCredits,
          totalUsedCredits: user.creditWallet.totalUsedCredits,
        }
      : null,
    sessions: user.sessions.map((s) => {
      const usage = conversationUsageMap.get(s.id);
      return {
        id: s.id,
        title: s.title ?? "",
        mode: s.mode,
        updatedAt: s.updatedAt.toISOString(),
        resultCount: s._count.results,
        requests: usage?.requests ?? 0,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        estimatedCostUsd: usage?.estimatedCostUsd ?? 0,
      };
    }),
    couponRedemptions: user.couponRedemptions.map((item) => ({
      id: item.id,
      // A redeemed coupon remains a credential-shaped value. The user-detail
      // view needs the grant type and result, not the reusable raw code.
      couponCode: "[redacted]",
      couponType: item.coupon.type,
      result: item.result,
      note: item.note,
      createdAt: item.createdAt.toISOString(),
    })),
    aiRequests: user.aiRequests.map((item) => ({
      id: item.id,
      requestType: item.requestType,
      provider: item.provider,
      model: item.model,
      status: item.status,
      inputTokens: item.inputTokens ?? 0,
      outputTokens: item.outputTokens ?? 0,
      estimatedCostUsd: item.estimatedCostUsd ?? 0,
      createdAt: item.createdAt.toISOString(),
      conversationId: item.conversation?.id ?? null,
      conversationTitle: item.conversation?.title ?? null,
    })),
    subscription: user.subscription
      ? {
          isLifetime: user.subscription.isLifetime,
          planEndsAt: user.subscription.planEndsAt?.toISOString() ?? null,
        }
      : null,
  };

  return <AdminUserDetailClient user={data} />;
}
