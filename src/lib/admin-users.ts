import "server-only";

import type { Prisma, UserAccountStatus, UserRole } from "@prisma/client";
import {
  buildUserActivitySummaries,
  sortUserActivitySummaries,
  type AdminUserActivitySummary,
  type AdminUserSort,
} from "@/lib/admin-usage-metrics";
import { prisma } from "@/lib/prisma";

const userSortValues = new Set<AdminUserSort>([
  "latest",
  "tasks",
  "credits",
  "tokens",
  "created",
]);
const userStatusValues = new Set<UserAccountStatus>(["ACTIVE", "SUSPENDED"]);
const userRoleValues = new Set<UserRole>([
  "USER",
  "SUPPORT_VIEWER",
  "ADMIN",
  "SUPER_ADMIN",
]);

export type AdminUserListFilters = {
  q: string;
  sort: AdminUserSort;
  status: UserAccountStatus | "all";
  role: UserRole | "all";
  all: boolean;
};

export type AdminUserListRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  planType: string;
  billingType: string;
  createdAt: string;
  lastActiveAt: string;
  subscription: { isLifetime: boolean; planEndsAt: string | null } | null;
  usage: {
    totalTaskCount: number;
    completedTaskCount: number;
    activeTaskCount: number;
    totalCreditsUsed: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalEstimatedCostUsd: number;
    lastUsageAt: string;
    recentTasks: Array<{
      id: string;
      requestType: string;
      status: string;
      models: string[];
      creditsUsed: number;
      inputTokens: number;
      outputTokens: number;
      estimatedCostUsd: number;
      createdAt: string;
    }>;
  };
};

function normalizeSort(value?: string | null): AdminUserSort {
  return value && userSortValues.has(value as AdminUserSort)
    ? (value as AdminUserSort)
    : "latest";
}

function normalizeStatus(value?: string | null): UserAccountStatus | "all" {
  return value && userStatusValues.has(value as UserAccountStatus)
    ? (value as UserAccountStatus)
    : "all";
}

function normalizeRole(value?: string | null): UserRole | "all" {
  return value && userRoleValues.has(value as UserRole)
    ? (value as UserRole)
    : "all";
}

export function parseAdminUserListFilters(
  input: Partial<Record<string, string | undefined>>,
): AdminUserListFilters {
  return {
    q: input.q?.trim() ?? "",
    sort: normalizeSort(input.sort),
    status: normalizeStatus(input.status),
    role: normalizeRole(input.role),
    all: input.all === "1",
  };
}

function decimalToNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }
  return Number(value);
}

function serializeActivitySummary(summary: AdminUserActivitySummary) {
  return {
    totalTaskCount: summary.totalTaskCount,
    completedTaskCount: summary.completedTaskCount,
    activeTaskCount: summary.activeTaskCount,
    totalCreditsUsed: summary.totalCreditsUsed,
    totalInputTokens: summary.totalInputTokens,
    totalOutputTokens: summary.totalOutputTokens,
    totalEstimatedCostUsd: summary.totalEstimatedCostUsd,
    lastUsageAt: summary.lastUsageAt.toISOString(),
    recentTasks: summary.recentTasks.map((task) => ({
      id: task.id,
      requestType: task.requestType,
      status: task.status,
      models: task.models,
      creditsUsed: task.creditsUsed,
      inputTokens: task.inputTokens,
      outputTokens: task.outputTokens,
      estimatedCostUsd: task.estimatedCostUsd,
      createdAt: task.createdAt.toISOString(),
    })),
  };
}

export async function getAdminUserRows(filters: AdminUserListFilters) {
  const where: Prisma.UserWhereInput = {
    ...(filters.q
      ? {
          OR: [
            { email: { contains: filters.q } },
            { name: { contains: filters.q } },
          ],
        }
      : {}),
    ...(filters.status !== "all" ? { status: filters.status } : {}),
    ...(filters.role !== "all" ? { role: filters.role } : {}),
  };

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: filters.all ? undefined : 200,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      planType: true,
      billingType: true,
      createdAt: true,
      lastActiveAt: true,
      subscription: {
        select: {
          isLifetime: true,
          planEndsAt: true,
        },
      },
      sessions: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { updatedAt: true },
      },
    },
  });

  const userIds = users.map((user) => user.id);
  if (!userIds.length) {
    return [];
  }

  const [
    usageStats,
    recentUsageLogs,
    executionStats,
    completedExecutionStats,
    activeExecutionStats,
    recentExecutionRuns,
  ] = await Promise.all([
    prisma.usageLog.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds } },
      _count: { _all: true },
      _sum: {
        creditsUsed: true,
        inputTokenCount: true,
        outputTokenCount: true,
        estimatedCostUsd: true,
      },
      _max: { createdAt: true },
    }),
    prisma.usageLog.findMany({
      where: { userId: { in: userIds } },
      orderBy: { createdAt: "desc" },
      take: filters.all ? 900 : 600,
      select: {
        id: true,
        userId: true,
        requestType: true,
        selectedModels: true,
        creditsUsed: true,
        inputTokenCount: true,
        outputTokenCount: true,
        estimatedCostUsd: true,
        createdAt: true,
      },
    }),
    prisma.executionRun.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds } },
      _count: { _all: true },
      _max: { updatedAt: true, finishedAt: true },
    }),
    prisma.executionRun.groupBy({
      by: ["userId"],
      where: {
        userId: { in: userIds },
        status: { in: ["completed", "partial"] },
      },
      _count: { _all: true },
    }),
    prisma.executionRun.groupBy({
      by: ["userId"],
      where: {
        userId: { in: userIds },
        status: { in: ["queued", "running", "retrying", "canceling"] },
      },
      _count: { _all: true },
    }),
    prisma.executionRun.findMany({
      where: { userId: { in: userIds } },
      orderBy: { updatedAt: "desc" },
      take: filters.all ? 900 : 600,
      select: {
        id: true,
        userId: true,
        status: true,
        requestType: true,
        mode: true,
        totalStepsDone: true,
        totalStepsPlanned: true,
        createdAt: true,
        updatedAt: true,
        finishedAt: true,
      },
    }),
  ]);

  const baseRows = users.map((user) => ({
    ...user,
    lastActiveAt: user.lastActiveAt || user.sessions[0]?.updatedAt || user.createdAt,
  }));
  const summaries = buildUserActivitySummaries({
    users: baseRows,
    usageLogs: recentUsageLogs.map((log) => ({
      ...log,
      estimatedCostUsd: decimalToNumber(log.estimatedCostUsd),
    })),
    executionRuns: recentExecutionRuns,
  });

  for (const stat of usageStats) {
    const summary = summaries.get(stat.userId);
    if (!summary) {
      continue;
    }
    summary.totalTaskCount = Math.max(summary.totalTaskCount, stat._count._all);
    summary.completedTaskCount = Math.max(
      summary.completedTaskCount,
      stat._count._all,
    );
    summary.totalCreditsUsed = stat._sum.creditsUsed ?? 0;
    summary.totalInputTokens = stat._sum.inputTokenCount ?? 0;
    summary.totalOutputTokens = stat._sum.outputTokenCount ?? 0;
    summary.totalEstimatedCostUsd = decimalToNumber(stat._sum.estimatedCostUsd);
    if (
      stat._max.createdAt &&
      stat._max.createdAt.getTime() > summary.lastUsageAt.getTime()
    ) {
      summary.lastUsageAt = stat._max.createdAt;
    }
  }

  for (const stat of executionStats) {
    const summary = summaries.get(stat.userId);
    if (!summary) {
      continue;
    }
    summary.totalTaskCount = Math.max(summary.totalTaskCount, stat._count._all);
    const latestRunAt = stat._max.finishedAt ?? stat._max.updatedAt;
    if (latestRunAt && latestRunAt.getTime() > summary.lastUsageAt.getTime()) {
      summary.lastUsageAt = latestRunAt;
    }
  }

  for (const stat of completedExecutionStats) {
    const summary = summaries.get(stat.userId);
    if (summary) {
      summary.completedTaskCount = Math.max(
        summary.completedTaskCount,
        stat._count._all,
      );
    }
  }

  for (const stat of activeExecutionStats) {
    const summary = summaries.get(stat.userId);
    if (summary) {
      summary.activeTaskCount = Math.max(summary.activeTaskCount, stat._count._all);
    }
  }

  return sortUserActivitySummaries(baseRows, summaries, filters.sort).map((user) => {
    const summary = summaries.get(user.id);
    const activity = summary ?? {
      totalTaskCount: 0,
      completedTaskCount: 0,
      activeTaskCount: 0,
      totalCreditsUsed: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalEstimatedCostUsd: 0,
      lastUsageAt: user.lastActiveAt,
      recentTasks: [],
    };

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      planType: user.planType,
      billingType: user.billingType,
      createdAt: user.createdAt.toISOString(),
      lastActiveAt: activity.lastUsageAt.toISOString(),
      subscription: user.subscription
        ? {
            isLifetime: user.subscription.isLifetime,
            planEndsAt: user.subscription.planEndsAt?.toISOString() ?? null,
          }
        : null,
      usage: serializeActivitySummary(activity),
    } satisfies AdminUserListRow;
  });
}
