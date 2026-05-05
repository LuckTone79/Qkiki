import { NextResponse } from "next/server";
import { adminApiErrorResponse, requireApiAdminViewer } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function GET() {
  try {
    await requireApiAdminViewer();
    const today = startOfToday();

    const [
      totalUsers,
      activeUsers,
      totalConversations,
      todayQuestions,
      totalCoupons,
      activeCoupons,
      redeemedCoupons,
      todayCouponRedemptions,
      lifetimeUsers,
      monthlyUsers,
      auditCount,
      todayAiRequests,
      todayAiCost,
      todayAiErrors,
      providerUsage,
      modelUsage,
      topUserCosts,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.workbenchSession.count(),
      prisma.workbenchSession.count({ where: { createdAt: { gte: today } } }),
      prisma.coupon.count(),
      prisma.coupon.count({ where: { isActive: true, redeemedAt: null } }),
      prisma.coupon.count({ where: { redeemedAt: { not: null } } }),
      prisma.couponRedemption.count({ where: { createdAt: { gte: today } } }),
      prisma.userSubscription.count({ where: { isLifetime: true } }),
      prisma.userSubscription.count({ where: { isLifetime: false, planEndsAt: { gt: new Date() } } }),
      prisma.adminAuditLog.count(),
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

    return NextResponse.json({
      metrics: {
        totalUsers,
        activeUsers,
        totalConversations,
        todayQuestions,
        totalCoupons,
        activeCoupons,
        redeemedCoupons,
        todayCouponRedemptions,
        lifetimeUsers,
        monthlyUsers,
        auditCount,
        todayAiRequests,
        todayEstimatedCost: todayAiCost._sum.estimatedCostUsd ?? 0,
        todayAiErrors,
      },
      usage: {
        providers: providerUsage
          .map((item) => ({
            provider: item.provider,
            requests: item._count._all,
            estimatedCost: item._sum.estimatedCostUsd ?? 0,
          }))
          .sort((a, b) => b.requests - a.requests),
        models: modelUsage
          .map((item) => ({
            provider: item.provider,
            model: item.model,
            requests: item._count._all,
            estimatedCost: item._sum.estimatedCostUsd ?? 0,
          }))
          .sort((a, b) => b.requests - a.requests)
          .slice(0, 10),
        topUsers: topUserCosts
          .map((item) => {
            const user = topUsers.find((candidate) => candidate.id === item.userId);
            return {
              userId: item.userId,
              email: user?.email ?? "Unknown user",
              name: user?.name ?? null,
              requests: item._count._all,
              estimatedCost: item._sum.estimatedCostUsd ?? 0,
            };
          })
          .sort((a, b) => b.estimatedCost - a.estimatedCost)
          .slice(0, 5),
      },
    });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
