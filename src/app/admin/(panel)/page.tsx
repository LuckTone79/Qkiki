import { prisma } from "@/lib/prisma";
import {
  AdminDashboardClient,
  type DashboardMetrics,
  type UsageRow,
  type RecentAuditItem,
} from "@/components/admin/AdminDashboardClient";

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export default async function AdminDashboardPage() {
  const today = startOfToday();
  const [
    totalUsers,
    activeUsers,
    conversations,
    todayQuestions,
    coupons,
    redeemedCoupons,
    todayCouponRedemptions,
    lifetimeUsers,
    monthlyUsers,
    todayAiRequests,
    todayAiCost,
    todayAiErrors,
    providerUsage,
    modelUsage,
    topUserCosts,
    recentAudits,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.workbenchSession.count(),
    prisma.workbenchSession.count({ where: { createdAt: { gte: today } } }),
    prisma.coupon.count(),
    prisma.coupon.count({ where: { redeemedAt: { not: null } } }),
    prisma.couponRedemption.count({ where: { createdAt: { gte: today } } }),
    prisma.userSubscription.count({ where: { isLifetime: true } }),
    prisma.userSubscription.count({ where: { isLifetime: false, planEndsAt: { gt: new Date() } } }),
    prisma.aiRequest.count({ where: { createdAt: { gte: today } } }),
    prisma.aiRequest.aggregate({
      where: { createdAt: { gte: today } },
      _sum: { estimatedCostUsd: true },
    }),
    prisma.aiRequest.count({
      where: { createdAt: { gte: today }, status: "failed" },
    }),
    prisma.aiRequest.groupBy({
      by: ["provider"],
      where: { createdAt: { gte: today } },
      _count: { _all: true },
      _sum: { estimatedCostUsd: true },
    }),
    prisma.aiRequest.groupBy({
      by: ["provider", "model"],
      where: { createdAt: { gte: today } },
      _count: { _all: true },
      _sum: { estimatedCostUsd: true },
    }),
    prisma.aiRequest.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: today } },
      _count: { _all: true },
      _sum: { estimatedCostUsd: true },
    }),
    prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        adminUser: { select: { email: true, name: true } },
      },
    }),
  ]);

  const topUserIds = topUserCosts
    .sort((a, b) => (b._sum.estimatedCostUsd ?? 0) - (a._sum.estimatedCostUsd ?? 0))
    .slice(0, 5)
    .map((item) => item.userId);
  const topUsers = topUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: topUserIds } },
        select: { id: true, email: true, name: true },
      })
    : [];
  const topUserRows: UsageRow[] = topUserCosts
    .map((item) => {
      const user = topUsers.find((candidate) => candidate.id === item.userId);
      return {
        label: user?.name || user?.email || "Unknown user",
        requests: item._count._all,
        estimatedCost: item._sum.estimatedCostUsd ?? 0,
      };
    })
    .sort((a, b) => b.estimatedCost - a.estimatedCost)
    .slice(0, 5);

  const metrics: DashboardMetrics = {
    totalUsers,
    activeUsers,
    conversations,
    todayQuestions,
    todayAiRequests,
    todayAiCostUsd: todayAiCost._sum.estimatedCostUsd ?? 0,
    todayAiErrors,
    todayCouponRedemptions,
    coupons,
    redeemedCoupons,
    lifetimeUsers,
    monthlyUsers,
  };

  const providerUsageRows: UsageRow[] = providerUsage
    .map((item) => ({
      label: item.provider,
      requests: item._count._all,
      estimatedCost: item._sum.estimatedCostUsd ?? 0,
    }))
    .sort((a, b) => b.requests - a.requests);

  const modelUsageRows: UsageRow[] = modelUsage
    .map((item) => ({
      label: `${item.provider}/${item.model}`,
      requests: item._count._all,
      estimatedCost: item._sum.estimatedCostUsd ?? 0,
    }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 8);

  const recentAuditItems: RecentAuditItem[] = recentAudits.map((log) => ({
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    adminName: log.adminUser?.name || log.adminUser?.email || "-",
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
  }));

  return (
    <AdminDashboardClient
      metrics={metrics}
      providerUsage={providerUsageRows}
      modelUsage={modelUsageRows}
      topUserRows={topUserRows}
      recentAudits={recentAuditItems}
    />
  );
}
