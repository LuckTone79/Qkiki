import "server-only";

import { BillingType, PlanType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUserSubscriptionState } from "@/lib/subscription";
import { hasActiveSubscription } from "@/lib/access-policy";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const FREE_POLICY = {
  dailyLimit: 10,
  inputCharLimit: 3000,
  resultSaveLimit: 10,
  shareDailyLimit: 3,
  advancedReasoningDailyLimit: 1,
};

const BOOST_POLICY = {
  dailyLimit: 30,
  inputCharLimit: 5000,
  resultSaveLimit: 50,
  shareDailyLimit: 10,
  advancedReasoningDailyLimit: 3,
};

const STARTER_POLICY = {
  dailyLimit: 100,
  inputCharLimit: 20000,
  resultSaveLimit: 200,
  shareDailyLimit: 30,
  advancedReasoningDailyLimit: 10,
};

const PRO_POLICY = {
  dailyLimit: 300,
  inputCharLimit: 100000,
  resultSaveLimit: 1000,
  shareDailyLimit: 100,
  advancedReasoningDailyLimit: 50,
};

const TEAM_POLICY = {
  dailyLimit: 600,
  inputCharLimit: 100000,
  resultSaveLimit: 5000,
  shareDailyLimit: 300,
  advancedReasoningDailyLimit: 200,
};

type UserUsageProfile = {
  id: string;
  planType: PlanType;
  billingType: BillingType;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  isTrialUsed: boolean;
};

export type UsageStatusSummary = {
  planType: PlanType;
  billingType: BillingType;
  planLabel: "free" | "boost" | "starter" | "pro" | "team";
  isBoostActive: boolean;
  boostEndsAt: string | null;
  boostDaysRemaining: number;
  dailyLimit: number;
  dailyUsed: number;
  remaining: number;
  inputCharLimit: number;
  resultSaveLimit: number;
  shareDailyLimit: number;
  advancedReasoningDailyLimit: number;
  warningThresholdReached: boolean;
  isLimitReached: boolean;
  resetAt: string;
};

export type ResolvedUsagePolicy = Omit<
  UsageStatusSummary,
  "dailyUsed" | "remaining" | "warningThresholdReached" | "isLimitReached" | "resetAt"
> & {
  resetAt: Date;
};

export type UsageCheckContext = {
  policy: ResolvedUsagePolicy;
  usage: {
    id: string;
    dailyRequestLimit: number;
    dailyRequestUsed: number;
  };
};

export class UsageLimitReachedError extends Error {
  summary: UsageStatusSummary;

  constructor(summary: UsageStatusSummary) {
    super("오늘의 사용량을 모두 사용했어요.");
    this.summary = summary;
  }
}

export class UsageInputLimitError extends Error {
  summary: UsageStatusSummary;

  constructor(summary: UsageStatusSummary) {
    const prefix = summary.isBoostActive
      ? "Boost 기간에는"
      : summary.planType === PlanType.FREE
        ? "Free 사용자는"
        : `${summary.planLabel.toUpperCase()} 플랜에서는`;

    super(
      `현재 플랜에서 입력 가능한 길이를 초과했어요. ${prefix} ${summary.inputCharLimit.toLocaleString()}자까지 입력할 수 있어요.`,
    );
    this.summary = summary;
  }
}

function getKstDateInfo(now = new Date()) {
  const shifted = new Date(now.getTime() + KST_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  const usageDate = new Date(Date.UTC(year, month, day));
  const resetAt = new Date(Date.UTC(year, month, day + 1) - KST_OFFSET_MS);
  return { usageDate, resetAt };
}

function decimal(value: number) {
  return new Prisma.Decimal(value.toFixed(6));
}

function daysRemainingInclusive(endsAt: Date | null, now = new Date()) {
  if (!endsAt || endsAt.getTime() <= now.getTime()) {
    return 0;
  }

  return Math.max(
    1,
    Math.ceil((endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
  );
}

async function getUserUsageProfile(userId: string) {
  const [user, subscription] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        planType: true,
        billingType: true,
        trialStartedAt: true,
        trialEndsAt: true,
        isTrialUsed: true,
      },
    }),
    getUserSubscriptionState(userId),
  ]);

  if (!user) {
    throw new Error("User not found.");
  }

  return { user, subscription };
}

function resolvePolicy(input: {
  profile: UserUsageProfile;
  hasLegacySubscription: boolean;
  now?: Date;
}): ResolvedUsagePolicy {
  const now = input.now ?? new Date();
  const { resetAt } = getKstDateInfo(now);
  const boostActive = Boolean(
    input.profile.trialStartedAt &&
      input.profile.trialEndsAt &&
      input.profile.trialStartedAt.getTime() <= now.getTime() &&
      input.profile.trialEndsAt.getTime() >= now.getTime(),
  );

  if (input.profile.planType === PlanType.TEAM) {
    return {
      planType: PlanType.TEAM,
      billingType: input.profile.billingType,
      planLabel: "team",
      isBoostActive: false,
      boostEndsAt: null,
      boostDaysRemaining: 0,
      resetAt,
      ...TEAM_POLICY,
    };
  }

  if (input.profile.planType === PlanType.PRO || input.hasLegacySubscription) {
    return {
      planType: PlanType.PRO,
      billingType: input.hasLegacySubscription && input.profile.billingType === BillingType.NONE
        ? BillingType.MONTHLY
        : input.profile.billingType,
      planLabel: "pro",
      isBoostActive: false,
      boostEndsAt: null,
      boostDaysRemaining: 0,
      resetAt,
      ...PRO_POLICY,
    };
  }

  if (input.profile.planType === PlanType.STARTER) {
    return {
      planType: PlanType.STARTER,
      billingType: input.profile.billingType,
      planLabel: "starter",
      isBoostActive: false,
      boostEndsAt: null,
      boostDaysRemaining: 0,
      resetAt,
      ...STARTER_POLICY,
    };
  }

  if (boostActive) {
    return {
      planType: PlanType.FREE,
      billingType: BillingType.NONE,
      planLabel: "boost",
      isBoostActive: true,
      boostEndsAt: input.profile.trialEndsAt?.toISOString() ?? null,
      boostDaysRemaining: daysRemainingInclusive(input.profile.trialEndsAt, now),
      resetAt,
      ...BOOST_POLICY,
    };
  }

  return {
    planType: PlanType.FREE,
    billingType: BillingType.NONE,
    planLabel: "free",
    isBoostActive: false,
    boostEndsAt: input.profile.trialEndsAt?.toISOString() ?? null,
    boostDaysRemaining: 0,
    resetAt,
    ...FREE_POLICY,
  };
}

async function getOrCreateUsageRecord(userId: string, policy: ResolvedUsagePolicy) {
  const { usageDate } = getKstDateInfo();
  const existing = await prisma.usageLimit.findUnique({
    where: {
      userId_usageDate: {
        userId,
        usageDate,
      },
    },
  });

  if (existing) {
    if (
      existing.dailyRequestLimit !== policy.dailyLimit ||
      existing.resetAt.getTime() !== policy.resetAt.getTime()
    ) {
      return prisma.usageLimit.update({
        where: { id: existing.id },
        data: {
          dailyRequestLimit: policy.dailyLimit,
          resetAt: policy.resetAt,
        },
      });
    }

    return existing;
  }

  return prisma.usageLimit.create({
    data: {
      userId,
      usageDate,
      dailyRequestLimit: policy.dailyLimit,
      resetAt: policy.resetAt,
    },
  });
}

function toSummary(policy: ResolvedUsagePolicy, dailyUsed: number): UsageStatusSummary {
  const remaining = Math.max(0, policy.dailyLimit - dailyUsed);

  return {
    ...policy,
    resetAt: policy.resetAt.toISOString(),
    dailyUsed,
    remaining,
    warningThresholdReached: policy.dailyLimit > 0 ? dailyUsed / policy.dailyLimit >= 0.8 : false,
    isLimitReached: dailyUsed >= policy.dailyLimit,
  };
}

export async function getUsageStatus(userId: string) {
  const { user, subscription } = await getUserUsageProfile(userId);
  const policy = resolvePolicy({
    profile: user,
    hasLegacySubscription: hasActiveSubscription(subscription),
  });
  const usage = await getOrCreateUsageRecord(userId, policy);
  return toSummary(policy, usage.dailyRequestUsed);
}

export async function requireUsageAccess(input: {
  userId: string;
  inputCharCount: number;
}) {
  const { user, subscription } = await getUserUsageProfile(input.userId);
  const policy = resolvePolicy({
    profile: user,
    hasLegacySubscription: hasActiveSubscription(subscription),
  });
  const usage = await getOrCreateUsageRecord(input.userId, policy);
  const summary = toSummary(policy, usage.dailyRequestUsed);

  if (summary.isLimitReached) {
    throw new UsageLimitReachedError(summary);
  }

  if (input.inputCharCount > summary.inputCharLimit) {
    throw new UsageInputLimitError(summary);
  }

  return {
    policy,
    usage: {
      id: usage.id,
      dailyRequestLimit: usage.dailyRequestLimit,
      dailyRequestUsed: usage.dailyRequestUsed,
    },
  } satisfies UsageCheckContext;
}

export async function recordUsageSuccess(input: {
  userId: string;
  requestType: string;
  selectedModels: string[];
  inputCharCount: number;
  inputTokenCount: number;
  outputTokenCount: number;
  estimatedCostUsd: number;
  creditsUsed?: number;
  context?: UsageCheckContext;
}) {
  const context =
    input.context ??
    (await requireUsageAccess({
      userId: input.userId,
      inputCharCount: 0,
    }));

  const updatedUsage = await prisma.$transaction(async (tx) => {
    const usage = await tx.usageLimit.update({
      where: { id: context.usage.id },
      data: {
        dailyRequestLimit: context.policy.dailyLimit,
        resetAt: context.policy.resetAt,
        dailyRequestUsed: { increment: 1 },
      },
    });

    await tx.usageLog.create({
      data: {
        userId: input.userId,
        requestType: input.requestType,
        selectedModels: input.selectedModels,
        planTypeSnapshot: context.policy.planType,
        billingTypeSnapshot: context.policy.billingType,
        isBoostSnapshot: context.policy.isBoostActive,
        inputCharCount: input.inputCharCount,
        inputTokenCount: input.inputTokenCount,
        outputTokenCount: input.outputTokenCount,
        requestCountCharged: 1,
        estimatedCostUsd: decimal(input.estimatedCostUsd),
        creditsUsed: input.creditsUsed ?? 0,
      },
    });

    return usage;
  });

  return toSummary(context.policy, updatedUsage.dailyRequestUsed);
}

export async function grantWelcomeBoostToUser(userId: string) {
  const now = new Date();
  const endsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: {
      planType: PlanType.FREE,
      billingType: BillingType.NONE,
      trialStartedAt: now,
      trialEndsAt: endsAt,
      isTrialUsed: true,
    },
  });
}
