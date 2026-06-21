import "server-only";

import { prisma } from "@/lib/prisma";

export const USER_SORT_OPTIONS = [
  "recentActive",
  "recentJoined",
  "mostConversations",
  "mostRequests",
  "mostCredits",
  "mostCost",
  "mostTokens",
] as const;

export type UserSortOption = (typeof USER_SORT_OPTIONS)[number];

export function normalizeUserSort(value: string | undefined): UserSortOption {
  if (value && (USER_SORT_OPTIONS as readonly string[]).includes(value)) {
    return value as UserSortOption;
  }
  return "recentActive";
}

export type AdminUserListRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  createdAt: string;
  lastActiveAt: string;
  subscription: { isLifetime: boolean; planEndsAt: string | null } | null;
  totalConversations: number;
  totalRequests: number;
  creditsUsed: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
};

type UsageAggregate = {
  totalConversations: number;
  totalRequests: number;
  creditsUsed: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
};

const EMPTY_AGGREGATE: UsageAggregate = {
  totalConversations: 0,
  totalRequests: 0,
  creditsUsed: 0,
  inputTokens: 0,
  outputTokens: 0,
  estimatedCostUsd: 0,
};

/**
 * Loads the admin user list together with per-user usage stats (conversations,
 * AI requests, credits, tokens, estimated cost) so the admin console can show
 * and sort by real usage without drilling into each user.
 */
export async function getAdminUserList(options: {
  q?: string;
  sort?: UserSortOption;
  limit?: number;
}): Promise<AdminUserListRow[]> {
  const q = options.q?.trim() || "";
  const sort = options.sort ?? "recentActive";
  const limit = options.limit ?? 100;

  const where = q
    ? {
        OR: [
          { email: { contains: q } },
          { name: { contains: q } },
        ],
      }
    : undefined;

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
      lastActiveAt: true,
      subscription: {
        select: { isLifetime: true, planEndsAt: true },
      },
      sessions: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { updatedAt: true },
      },
    },
  });

  const userIds = users.map((user) => user.id);

  const [conversationGroups, requestGroups, usageGroups] = userIds.length
    ? await Promise.all([
        prisma.workbenchSession.groupBy({
          by: ["userId"],
          where: { userId: { in: userIds } },
          _count: { _all: true },
        }),
        prisma.aiRequest.groupBy({
          by: ["userId"],
          where: { userId: { in: userIds } },
          _count: { _all: true },
          _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true },
        }),
        prisma.usageLog.groupBy({
          by: ["userId"],
          where: { userId: { in: userIds } },
          _sum: { creditsUsed: true },
        }),
      ])
    : [[], [], []];

  const aggregates = new Map<string, UsageAggregate>();
  const ensure = (userId: string) => {
    let entry = aggregates.get(userId);
    if (!entry) {
      entry = { ...EMPTY_AGGREGATE };
      aggregates.set(userId, entry);
    }
    return entry;
  };

  for (const group of conversationGroups) {
    ensure(group.userId).totalConversations = group._count._all;
  }
  for (const group of requestGroups) {
    const entry = ensure(group.userId);
    entry.totalRequests = group._count._all;
    entry.inputTokens = group._sum.inputTokens ?? 0;
    entry.outputTokens = group._sum.outputTokens ?? 0;
    entry.estimatedCostUsd = group._sum.estimatedCostUsd ?? 0;
  }
  for (const group of usageGroups) {
    ensure(group.userId).creditsUsed = group._sum.creditsUsed ?? 0;
  }

  const rows: AdminUserListRow[] = users.map((user) => {
    const aggregate = aggregates.get(user.id) ?? EMPTY_AGGREGATE;
    const lastActiveAt =
      user.lastActiveAt || user.sessions[0]?.updatedAt || user.createdAt;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      lastActiveAt: lastActiveAt.toISOString(),
      subscription: user.subscription
        ? {
            isLifetime: user.subscription.isLifetime,
            planEndsAt: user.subscription.planEndsAt?.toISOString() ?? null,
          }
        : null,
      totalConversations: aggregate.totalConversations,
      totalRequests: aggregate.totalRequests,
      creditsUsed: aggregate.creditsUsed,
      inputTokens: aggregate.inputTokens,
      outputTokens: aggregate.outputTokens,
      estimatedCostUsd: aggregate.estimatedCostUsd,
    };
  });

  rows.sort((a, b) => {
    switch (sort) {
      case "recentJoined":
        return b.createdAt.localeCompare(a.createdAt);
      case "mostConversations":
        return b.totalConversations - a.totalConversations;
      case "mostRequests":
        return b.totalRequests - a.totalRequests;
      case "mostCredits":
        return b.creditsUsed - a.creditsUsed;
      case "mostCost":
        return b.estimatedCostUsd - a.estimatedCostUsd;
      case "mostTokens":
        return b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens);
      case "recentActive":
      default:
        return b.lastActiveAt.localeCompare(a.lastActiveAt);
    }
  });

  return rows.slice(0, limit);
}
