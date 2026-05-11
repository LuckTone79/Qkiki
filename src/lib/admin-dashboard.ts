import "server-only";

import { prisma } from "@/lib/prisma";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function getKstUsageDate(now = new Date()) {
  const shifted = new Date(now.getTime() + KST_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  return new Date(Date.UTC(year, month, day));
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function getAdminDashboardData() {
  const today = startOfToday();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const usageDate = getKstUsageDate();

  const [
    totalUsers,
    activeUsers,
    totalConversations,
    todayQuestions,
    totalCoupons,
    redeemedCoupons,
    todayCouponRedemptions,
    lifetimeUsers,
    monthlyUsers,
    todayAiRequests,
    todayAiCost,
    todayAiErrors,
    requestBreakdown,
    providerUsage,
    modelUsage,
    topUserCosts,
    monthlyUserCosts,
    recentAudits,
    usageLimits,
    activePaidUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.workbenchSession.count(),
    prisma.workbenchSession.count({ where: { createdAt: { gte: today } } }),
    prisma.coupon.count(),
    prisma.coupon.count({ where: { redeemedAt: { not: null } } }),
    prisma.couponRedemption.count({ where: { createdAt: { gte: today } } }),
    prisma.userSubscription.count({ where: { isLifetime: true } }),
    prisma.userSubscription.count({
      where: { isLifetime: false, planEndsAt: { gt: new Date() } },
    }),
    prisma.aiRequest.count({ where: { createdAt: { gte: today } } }),
    prisma.aiRequest.aggregate({
      where: { createdAt: { gte: today } },
      _sum: { estimatedCostUsd: true },
    }),
    prisma.aiRequest.count({
      where: { createdAt: { gte: today }, status: "failed" },
    }),
    prisma.usageLog.groupBy({
      by: ["planTypeSnapshot", "isBoostSnapshot"],
      where: { createdAt: { gte: today } },
      _count: { _all: true },
    }),
    prisma.aiRequest.groupBy({
      by: ["provider"],
      where: { createdAt: { gte: today } },
      _count: { _all: true },
      _sum: {
        estimatedCostUsd: true,
        inputTokens: true,
        outputTokens: true,
      },
    }),
    prisma.aiRequest.groupBy({
      by: ["provider", "model"],
      where: { createdAt: { gte: today } },
      _count: { _all: true },
      _sum: {
        estimatedCostUsd: true,
        inputTokens: true,
        outputTokens: true,
      },
    }),
    prisma.aiRequest.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: today } },
      _count: { _all: true },
      _sum: { estimatedCostUsd: true },
    }),
    prisma.aiRequest.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: monthStart } },
      _count: { _all: true },
      _sum: {
        estimatedCostUsd: true,
        inputTokens: true,
        outputTokens: true,
      },
    }),
    prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        adminUser: { select: { email: true, name: true } },
      },
    }),
    prisma.usageLimit.findMany({
      where: { usageDate },
      select: { dailyRequestUsed: true, dailyRequestLimit: true },
    }),
    prisma.user.count({
      where: {
        OR: [
          { planType: { in: ["STARTER", "PRO", "TEAM"] } },
          { subscription: { is: { isLifetime: true } } },
          { subscription: { is: { planEndsAt: { gt: new Date() } } } },
        ],
      },
    }),
  ]);

  const topUserIds = topUserCosts
    .sort(
      (a, b) =>
        (b._sum.estimatedCostUsd ?? 0) - (a._sum.estimatedCostUsd ?? 0),
    )
    .slice(0, 5)
    .map((item) => item.userId);
  const topUsers = topUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: topUserIds } },
        select: { id: true, email: true, name: true },
      })
    : [];
  const monthlyTopUserIds = monthlyUserCosts
    .sort((a, b) => (b._sum.estimatedCostUsd ?? 0) - (a._sum.estimatedCostUsd ?? 0))
    .slice(0, 20)
    .map((item) => item.userId);
  const monthlyTopUsers = monthlyTopUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: monthlyTopUserIds } },
        select: { id: true, email: true, name: true },
      })
    : [];

  const todayTotalRequests = requestBreakdown.reduce(
    (sum, row) => sum + row._count._all,
    0,
  );
  const freeUserRequests = requestBreakdown
    .filter((row) => row.planTypeSnapshot === "FREE" && !row.isBoostSnapshot)
    .reduce((sum, row) => sum + row._count._all, 0);
  const boostUserRequests = requestBreakdown
    .filter((row) => row.isBoostSnapshot)
    .reduce((sum, row) => sum + row._count._all, 0);
  const paidUserRequests = requestBreakdown
    .filter((row) => row.planTypeSnapshot !== "FREE")
    .reduce((sum, row) => sum + row._count._all, 0);
  const limitReachedUsers = usageLimits.filter(
    (row) => row.dailyRequestUsed >= row.dailyRequestLimit,
  ).length;
  const freeToPaidConversionRate =
    totalUsers > 0 ? Number(((activePaidUsers / totalUsers) * 100).toFixed(1)) : 0;
  const suspiciousRepeatSignups = 0;

  return {
    metrics: {
      totalUsers,
      activeUsers,
      totalConversations,
      todayQuestions,
      totalCoupons,
      redeemedCoupons,
      todayCouponRedemptions,
      lifetimeUsers,
      monthlyUsers,
      todayAiRequests,
      todayEstimatedCost: todayAiCost._sum.estimatedCostUsd ?? 0,
      todayAiErrors,
      todayTotalRequests,
      freeUserRequests,
      boostUserRequests,
      paidUserRequests,
      limitReachedUsers,
      freeToPaidConversionRate,
      suspiciousRepeatSignups,
    },
    providerUsageRows: providerUsage
      .map((item) => ({
        label: item.provider,
        requests: item._count._all,
        estimatedCost: item._sum.estimatedCostUsd ?? 0,
        inputTokens: item._sum.inputTokens ?? 0,
        outputTokens: item._sum.outputTokens ?? 0,
      }))
      .sort((a, b) => b.requests - a.requests),
    modelUsageRows: modelUsage
      .map((item) => ({
        label: `${item.provider}/${item.model}`,
        requests: item._count._all,
        estimatedCost: item._sum.estimatedCostUsd ?? 0,
        inputTokens: item._sum.inputTokens ?? 0,
        outputTokens: item._sum.outputTokens ?? 0,
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10),
    topUserRows: topUserCosts
      .map((item) => {
        const user = topUsers.find((candidate) => candidate.id === item.userId);
        return {
          label: user?.name || user?.email || "Unknown user",
          requests: item._count._all,
          estimatedCost: item._sum.estimatedCostUsd ?? 0,
          inputTokens: 0,
          outputTokens: 0,
        };
      })
      .sort((a, b) => b.estimatedCost - a.estimatedCost)
      .slice(0, 5),
    monthlyUserCostRows: monthlyUserCosts
      .map((item) => {
        const user = monthlyTopUsers.find((candidate) => candidate.id === item.userId);
        return {
          label: user?.name || user?.email || "Unknown user",
          requests: item._count._all,
          estimatedCost: item._sum.estimatedCostUsd ?? 0,
          inputTokens: item._sum.inputTokens ?? 0,
          outputTokens: item._sum.outputTokens ?? 0,
        };
      })
      .sort((a, b) => b.estimatedCost - a.estimatedCost)
      .slice(0, 20),
    recentAudits: recentAudits.map((log) => ({
      id: log.id,
      createdAt: log.createdAt.toISOString(),
      adminName: log.adminUser?.name || log.adminUser?.email || "-",
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
    })),
  };
}
