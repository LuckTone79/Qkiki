import "server-only";

import { BillingType, PlanType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasActiveSubscription } from "@/lib/access-policy";
import { CREDIT_PRICING_VERSION, costUsdToCredits } from "@/lib/credits";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const RESERVATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const FREE_POLICY = {
  dailyLimit: 10,
  monthlyCreditLimit: 50,
  dailyCreditLimit: 25,
  inputCharLimit: 3000,
  resultSaveLimit: 10,
  shareDailyLimit: 3,
  advancedReasoningDailyLimit: 1,
};

const BOOST_POLICY = {
  dailyLimit: 30,
  monthlyCreditLimit: 250,
  dailyCreditLimit: 80,
  inputCharLimit: 5000,
  resultSaveLimit: 50,
  shareDailyLimit: 10,
  advancedReasoningDailyLimit: 3,
};

const STARTER_POLICY = {
  dailyLimit: 100,
  monthlyCreditLimit: 1800,
  dailyCreditLimit: 300,
  inputCharLimit: 20000,
  resultSaveLimit: 200,
  shareDailyLimit: 30,
  advancedReasoningDailyLimit: 10,
};

const PRO_POLICY = {
  dailyLimit: 300,
  monthlyCreditLimit: 6000,
  dailyCreditLimit: 1000,
  inputCharLimit: 100000,
  resultSaveLimit: 1000,
  shareDailyLimit: 100,
  advancedReasoningDailyLimit: 50,
};

const TEAM_POLICY = {
  dailyLimit: 600,
  monthlyCreditLimit: 20000,
  dailyCreditLimit: 3500,
  inputCharLimit: 100000,
  resultSaveLimit: 5000,
  shareDailyLimit: 300,
  advancedReasoningDailyLimit: 200,
};

const UNLIMITED_DAILY_LIMIT = 1_000_000_000;

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
  isUnlimitedDaily: boolean;
  dailyUsed: number;
  remaining: number;
  monthlyCreditLimit: number;
  monthlyCreditsUsed: number;
  monthlyCreditsRemaining: number;
  dailyCreditLimit: number;
  dailyCreditsUsed: number;
  dailyCreditsRemaining: number;
  paidCredits: number;
  bonusCredits: number;
  couponCreditBalance: number;
  couponCreditEndsAt: string | null;
  couponCreditActive: boolean;
  walletCreditsAvailable: number;
  planCreditsAvailable: number;
  totalCreditsAvailable: number;
  totalDailyCreditsAvailable: number;
  isCreditLimitReached: boolean;
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
  | "dailyUsed"
  | "remaining"
  | "monthlyCreditsUsed"
  | "monthlyCreditsRemaining"
  | "dailyCreditsUsed"
  | "dailyCreditsRemaining"
  | "paidCredits"
  | "bonusCredits"
  | "couponCreditBalance"
  | "couponCreditEndsAt"
  | "couponCreditActive"
  | "walletCreditsAvailable"
  | "planCreditsAvailable"
  | "totalCreditsAvailable"
  | "totalDailyCreditsAvailable"
  | "isCreditLimitReached"
  | "warningThresholdReached"
  | "isLimitReached"
  | "resetAt"
> & {
  resetAt: Date;
};

type CreditUsageSnapshot = {
  monthlyCreditsUsed: number;
  dailyCreditsUsed: number;
  pendingReservedCredits: number;
  paidCredits: number;
  bonusCredits: number;
  couponCreditBalance: number;
  couponCreditEndsAt: Date | null;
  couponCreditActive: boolean;
};

export type UsageCheckContext = {
  policy: ResolvedUsagePolicy;
  usage: {
    id: string;
    dailyRequestLimit: number;
    dailyRequestUsed: number;
    pendingReservedRequests: number;
    credit: CreditUsageSnapshot;
  };
};

export class UsageLimitReachedError extends Error {
  summary: UsageStatusSummary;

  constructor(summary: UsageStatusSummary) {
    super("Today’s usage limit has been reached.");
    this.summary = summary;
  }
}

export class UsageInputLimitError extends Error {
  summary: UsageStatusSummary;

  constructor(summary: UsageStatusSummary) {
    const prefix = summary.isBoostActive
      ? "Boost access allows"
      : summary.planType === PlanType.FREE
        ? "Free access allows"
        : `${summary.planLabel.toUpperCase()} plan allows`;

    super(
      `This request exceeds the current input limit. ${prefix} up to ${summary.inputCharLimit.toLocaleString()} characters.`,
    );
    this.summary = summary;
  }
}

export class UsageCreditLimitReachedError extends Error {
  summary: UsageStatusSummary;

  constructor(summary: UsageStatusSummary) {
    super("Not enough credits are available for this request.");
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

function getKstPeriodBounds(now = new Date()) {
  const shifted = new Date(now.getTime() + KST_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();

  const dayStartAt = new Date(Date.UTC(year, month, day) - KST_OFFSET_MS);
  const dayEndAt = new Date(Date.UTC(year, month, day + 1) - KST_OFFSET_MS);
  const monthStartAt = new Date(Date.UTC(year, month, 1) - KST_OFFSET_MS);
  const monthEndAt = new Date(Date.UTC(year, month + 1, 1) - KST_OFFSET_MS);

  return { dayStartAt, dayEndAt, monthStartAt, monthEndAt };
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

async function withSerializableRetries<T>(
  callback: () => Promise<T>,
  retries = 3,
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < retries) {
    try {
      return await callback();
    } catch (error) {
      const prismaCode =
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.code
          : null;
      if (prismaCode !== "P2034") {
        throw error;
      }
      lastError = error;
      attempt += 1;
    }
  }

  throw lastError ?? new Error("The transaction could not be completed.");
}

async function getUserUsageProfile(userId: string) {
  const [user, userSubscription] = await Promise.all([
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
    prisma.userSubscription.findUnique({
      where: { userId },
      select: {
        isLifetime: true,
        planEndsAt: true,
        couponDailyLimit: true,
        couponLimitEndsAt: true,
        couponLimitIsLifetime: true,
        couponCreditBalance: true,
        couponCreditEndsAt: true,
      },
    }),
  ]);

  if (!user) {
    throw new Error("User not found.");
  }

  return { user, userSubscription };
}

function resolvePolicy(input: {
  profile: UserUsageProfile;
  hasLegacySubscription: boolean;
  couponDailyLimit: number | null;
  couponLimitEndsAt: Date | null;
  couponLimitIsLifetime: boolean;
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
      isUnlimitedDaily: false,
      resetAt,
      ...TEAM_POLICY,
    };
  }

  if (input.profile.planType === PlanType.PRO || input.hasLegacySubscription) {
    const couponLimitActive = Boolean(
      input.couponLimitIsLifetime ||
        (input.couponLimitEndsAt &&
          input.couponLimitEndsAt.getTime() > now.getTime()),
    );
    const isUnlimitedDaily =
      couponLimitActive && input.couponDailyLimit == null;
    const resolvedDailyLimit = couponLimitActive
      ? (input.couponDailyLimit ?? UNLIMITED_DAILY_LIMIT)
      : PRO_POLICY.dailyLimit;
    return {
      planType: PlanType.PRO,
      billingType:
        input.hasLegacySubscription &&
        input.profile.billingType === BillingType.NONE
          ? BillingType.MONTHLY
          : input.profile.billingType,
      planLabel: "pro",
      isBoostActive: false,
      boostEndsAt: null,
      boostDaysRemaining: 0,
      resetAt,
      ...PRO_POLICY,
      dailyLimit: resolvedDailyLimit,
      isUnlimitedDaily,
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
      isUnlimitedDaily: false,
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
      isUnlimitedDaily: false,
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
    isUnlimitedDaily: false,
    resetAt,
    ...FREE_POLICY,
  };
}

async function getOrCreateUsageRecord(
  userId: string,
  policy: ResolvedUsagePolicy,
) {
  const { usageDate } = getKstDateInfo();
  return prisma.usageLimit.upsert({
    where: {
      userId_usageDate: {
        userId,
        usageDate,
      },
    },
    update: {
      dailyRequestLimit: policy.dailyLimit,
      resetAt: policy.resetAt,
    },
    create: {
      userId,
      usageDate,
      dailyRequestLimit: policy.dailyLimit,
      resetAt: policy.resetAt,
    },
  });
}

async function countPendingReservedRequests(input: { usageLimitId: string }) {
  return prisma.usageReservation.aggregate({
    where: {
      usageLimitId: input.usageLimitId,
      status: "reserved",
    },
    _sum: {
      reservedRequestCount: true,
      reservedCreditCount: true,
    },
  });
}

async function getCreditUsageSnapshot(input: {
  userId: string;
  usageLimitId: string;
  userSubscription:
    | {
        couponCreditBalance: number;
        couponCreditEndsAt: Date | null;
      }
    | null
    | undefined;
  now?: Date;
}): Promise<CreditUsageSnapshot> {
  const now = input.now ?? new Date();
  const { dayStartAt, dayEndAt, monthStartAt, monthEndAt } =
    getKstPeriodBounds(now);

  const [dailyUsage, monthlyUsage, pending, wallet] = await Promise.all([
    prisma.usageLog.aggregate({
      where: {
        userId: input.userId,
        createdAt: {
          gte: dayStartAt,
          lt: dayEndAt,
        },
      },
      _sum: {
        creditsUsed: true,
      },
    }),
    prisma.usageLog.aggregate({
      where: {
        userId: input.userId,
        createdAt: {
          gte: monthStartAt,
          lt: monthEndAt,
        },
      },
      _sum: {
        creditsUsed: true,
      },
    }),
    countPendingReservedRequests({ usageLimitId: input.usageLimitId }),
    prisma.creditWallet.findUnique({
      where: { userId: input.userId },
      select: {
        paidCredits: true,
        bonusCredits: true,
      },
    }),
  ]);

  const couponCreditActive = Boolean(
    input.userSubscription?.couponCreditEndsAt &&
      input.userSubscription.couponCreditEndsAt.getTime() > now.getTime() &&
      input.userSubscription.couponCreditBalance > 0,
  );

  return {
    monthlyCreditsUsed:
      (monthlyUsage._sum.creditsUsed ?? 0) +
      (pending._sum.reservedCreditCount ?? 0),
    dailyCreditsUsed:
      (dailyUsage._sum.creditsUsed ?? 0) +
      (pending._sum.reservedCreditCount ?? 0),
    pendingReservedCredits: pending._sum.reservedCreditCount ?? 0,
    paidCredits: wallet?.paidCredits ?? 0,
    bonusCredits: wallet?.bonusCredits ?? 0,
    couponCreditBalance: couponCreditActive
      ? input.userSubscription?.couponCreditBalance ?? 0
      : 0,
    couponCreditEndsAt: couponCreditActive
      ? input.userSubscription?.couponCreditEndsAt ?? null
      : null,
    couponCreditActive,
  };
}

function toSummary(
  policy: ResolvedUsagePolicy,
  dailyUsedCommitted: number,
  pendingReserved = 0,
  credit: CreditUsageSnapshot = {
    monthlyCreditsUsed: 0,
    dailyCreditsUsed: 0,
    pendingReservedCredits: 0,
    paidCredits: 0,
    bonusCredits: 0,
    couponCreditBalance: 0,
    couponCreditEndsAt: null,
    couponCreditActive: false,
  },
): UsageStatusSummary {
  const dailyUsed = dailyUsedCommitted + pendingReserved;
  const remaining = Math.max(0, policy.dailyLimit - dailyUsed);
  const monthlyCreditsRemaining = Math.max(
    0,
    policy.monthlyCreditLimit - credit.monthlyCreditsUsed,
  );
  const dailyCreditsRemaining = Math.max(
    0,
    policy.dailyCreditLimit - credit.dailyCreditsUsed,
  );
  const walletCreditsAvailable = credit.paidCredits + credit.bonusCredits;
  const planCreditsAvailable = monthlyCreditsRemaining;
  const totalCreditsAvailable =
    planCreditsAvailable + credit.couponCreditBalance + walletCreditsAvailable;
  const totalDailyCreditsAvailable =
    dailyCreditsRemaining + credit.couponCreditBalance + walletCreditsAvailable;

  return {
    ...policy,
    resetAt: policy.resetAt.toISOString(),
    dailyUsed,
    remaining,
    monthlyCreditsUsed: credit.monthlyCreditsUsed,
    monthlyCreditsRemaining,
    dailyCreditsUsed: credit.dailyCreditsUsed,
    dailyCreditsRemaining,
    paidCredits: credit.paidCredits,
    bonusCredits: credit.bonusCredits,
    couponCreditBalance: credit.couponCreditBalance,
    couponCreditEndsAt: credit.couponCreditEndsAt?.toISOString() ?? null,
    couponCreditActive: credit.couponCreditActive,
    walletCreditsAvailable,
    planCreditsAvailable,
    totalCreditsAvailable,
    totalDailyCreditsAvailable,
    isCreditLimitReached:
      totalCreditsAvailable <= 0 || totalDailyCreditsAvailable <= 0,
    warningThresholdReached:
      (policy.dailyLimit > 0 ? dailyUsed / policy.dailyLimit >= 0.8 : false) ||
      (policy.monthlyCreditLimit > 0
        ? credit.monthlyCreditsUsed / policy.monthlyCreditLimit >= 0.8
        : false),
    isLimitReached: dailyUsed >= policy.dailyLimit,
  };
}

export async function getUsageStatus(userId: string) {
  const { user, userSubscription } = await getUserUsageProfile(userId);
  const policy = resolvePolicy({
    profile: user,
    hasLegacySubscription: hasActiveSubscription({
      isLifetime: userSubscription?.isLifetime ?? false,
      planEndsAt: userSubscription?.planEndsAt ?? null,
    }),
    couponDailyLimit: userSubscription?.couponDailyLimit ?? null,
    couponLimitEndsAt: userSubscription?.couponLimitEndsAt ?? null,
    couponLimitIsLifetime: userSubscription?.couponLimitIsLifetime ?? false,
  });
  const usage = await getOrCreateUsageRecord(userId, policy);
  const pending = await countPendingReservedRequests({ usageLimitId: usage.id });
  const credit = await getCreditUsageSnapshot({
    userId,
    usageLimitId: usage.id,
    userSubscription,
  });
  return toSummary(
    policy,
    usage.dailyRequestUsed,
    pending._sum.reservedRequestCount ?? 0,
    credit,
  );
}

export async function requireUsageAccess(input: {
  userId: string;
  inputCharCount: number;
  estimatedCredits?: number;
}) {
  const { user, userSubscription } = await getUserUsageProfile(input.userId);
  const policy = resolvePolicy({
    profile: user,
    hasLegacySubscription: hasActiveSubscription({
      isLifetime: userSubscription?.isLifetime ?? false,
      planEndsAt: userSubscription?.planEndsAt ?? null,
    }),
    couponDailyLimit: userSubscription?.couponDailyLimit ?? null,
    couponLimitEndsAt: userSubscription?.couponLimitEndsAt ?? null,
    couponLimitIsLifetime: userSubscription?.couponLimitIsLifetime ?? false,
  });
  const usage = await getOrCreateUsageRecord(input.userId, policy);
  const pending = await countPendingReservedRequests({ usageLimitId: usage.id });
  const credit = await getCreditUsageSnapshot({
    userId: input.userId,
    usageLimitId: usage.id,
    userSubscription,
  });
  const pendingReservedRequests = pending._sum.reservedRequestCount ?? 0;
  const summary = toSummary(
    policy,
    usage.dailyRequestUsed,
    pendingReservedRequests,
    credit,
  );

  if (summary.isLimitReached) {
    throw new UsageLimitReachedError(summary);
  }

  if (input.inputCharCount > summary.inputCharLimit) {
    throw new UsageInputLimitError(summary);
  }

  if (
    input.estimatedCredits &&
    (input.estimatedCredits > summary.totalCreditsAvailable ||
      input.estimatedCredits > summary.totalDailyCreditsAvailable)
  ) {
    throw new UsageCreditLimitReachedError(summary);
  }

  return {
    policy,
    usage: {
      id: usage.id,
      dailyRequestLimit: usage.dailyRequestLimit,
      dailyRequestUsed: usage.dailyRequestUsed,
      pendingReservedRequests,
      credit,
    },
  } satisfies UsageCheckContext;
}

export async function reserveUsage(input: {
  userId: string;
  requestType: string;
  inputCharCount: number;
  reservationKey: string;
  estimatedCredits?: number;
  estimatedCostUsd?: number;
  maxApprovedCredits?: number;
  pricingVersion?: string;
  quote?: unknown;
  context?: UsageCheckContext;
}) {
  const context =
    input.context ??
    (await requireUsageAccess({
      userId: input.userId,
      inputCharCount: input.inputCharCount,
      estimatedCredits: input.estimatedCredits,
    }));

  const summary = toSummary(
    context.policy,
    context.usage.dailyRequestUsed,
    context.usage.pendingReservedRequests,
    context.usage.credit,
  );

  if (summary.isLimitReached) {
    throw new UsageLimitReachedError(summary);
  }

  if (
    input.estimatedCredits &&
    (input.estimatedCredits > summary.totalCreditsAvailable ||
      input.estimatedCredits > summary.totalDailyCreditsAvailable)
  ) {
    throw new UsageCreditLimitReachedError(summary);
  }

  return withSerializableRetries(() =>
    prisma.$transaction(
      async (tx) => {
        const existingReservation = await tx.usageReservation.findUnique({
          where: { reservationKey: input.reservationKey },
        });

        if (existingReservation) {
          return existingReservation;
        }

        const usage = await tx.usageLimit.update({
          where: { id: context.usage.id },
          data: {
            dailyRequestLimit: context.policy.dailyLimit,
            resetAt: context.policy.resetAt,
          },
        });

        const pending = await tx.usageReservation.aggregate({
          where: {
            usageLimitId: usage.id,
            status: "reserved",
          },
          _sum: {
            reservedRequestCount: true,
            reservedCreditCount: true,
          },
        });
        const pendingReservedRequests = pending._sum.reservedRequestCount ?? 0;
        const effectiveCredit = {
          ...context.usage.credit,
          monthlyCreditsUsed:
            context.usage.credit.monthlyCreditsUsed -
            context.usage.credit.pendingReservedCredits +
            (pending._sum.reservedCreditCount ?? 0),
          dailyCreditsUsed:
            context.usage.credit.dailyCreditsUsed -
            context.usage.credit.pendingReservedCredits +
            (pending._sum.reservedCreditCount ?? 0),
          pendingReservedCredits: pending._sum.reservedCreditCount ?? 0,
        };
        const effectiveSummary = toSummary(
          context.policy,
          usage.dailyRequestUsed,
          pendingReservedRequests,
          effectiveCredit,
        );

        if (effectiveSummary.isLimitReached) {
          throw new UsageLimitReachedError(effectiveSummary);
        }

        if (
          input.estimatedCredits &&
          (input.estimatedCredits > effectiveSummary.totalCreditsAvailable ||
            input.estimatedCredits > effectiveSummary.totalDailyCreditsAvailable)
        ) {
          throw new UsageCreditLimitReachedError(effectiveSummary);
        }

        return tx.usageReservation.create({
          data: {
            reservationKey: input.reservationKey,
            userId: input.userId,
            usageLimitId: usage.id,
            requestType: input.requestType,
            inputCharCount: input.inputCharCount,
            reservedRequestCount: 1,
            reservedCreditCount: input.estimatedCredits ?? 0,
            estimatedCostUsd: decimal(input.estimatedCostUsd ?? 0),
            maxApprovedCredits:
              input.maxApprovedCredits ?? input.estimatedCredits ?? 0,
            pricingVersion: input.pricingVersion ?? CREDIT_PRICING_VERSION,
            quoteJson:
              input.quote === undefined ? null : JSON.stringify(input.quote),
            status: "reserved",
            expiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}

async function applyCreditCharge(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    policy: ResolvedUsagePolicy;
    creditsUsed: number;
    now: Date;
  },
) {
  let remaining = Math.max(0, input.creditsUsed);
  if (remaining <= 0) {
    return;
  }

  const subscription = await tx.userSubscription.findUnique({
    where: { userId: input.userId },
    select: {
      couponCreditBalance: true,
      couponCreditEndsAt: true,
    },
  });

  if (
    subscription?.couponCreditEndsAt &&
    subscription.couponCreditEndsAt.getTime() > input.now.getTime() &&
    subscription.couponCreditBalance > 0
  ) {
    const couponCharge = Math.min(remaining, subscription.couponCreditBalance);
    remaining -= couponCharge;

    await tx.userSubscription.update({
      where: { userId: input.userId },
      data: {
        couponCreditBalance: { decrement: couponCharge },
      },
    });
  }

  const { monthStartAt, monthEndAt } = getKstPeriodBounds(input.now);
  const monthlyUsage = await tx.usageLog.aggregate({
    where: {
      userId: input.userId,
      createdAt: {
        gte: monthStartAt,
        lt: monthEndAt,
      },
    },
    _sum: {
      creditsUsed: true,
    },
  });
  const monthlyCreditsUsed = monthlyUsage._sum.creditsUsed ?? 0;
  const monthlyPlanRemaining = Math.max(
    0,
    input.policy.monthlyCreditLimit - monthlyCreditsUsed,
  );
  remaining = Math.max(0, remaining - monthlyPlanRemaining);

  if (remaining <= 0) {
    return;
  }

  const wallet = await tx.creditWallet.findUnique({
    where: { userId: input.userId },
    select: {
      paidCredits: true,
      bonusCredits: true,
    },
  });

  if (!wallet) {
    throw new Error("Not enough credits are available for this request.");
  }

  const bonusCharge = Math.min(remaining, wallet.bonusCredits);
  const paidCharge = Math.min(remaining - bonusCharge, wallet.paidCredits);
  const walletCharge = bonusCharge + paidCharge;

  if (walletCharge < remaining) {
    throw new Error("Not enough credits are available for this request.");
  }

  await tx.creditWallet.update({
    where: { userId: input.userId },
    data: {
      bonusCredits: { decrement: bonusCharge },
      paidCredits: { decrement: paidCharge },
      totalUsedCredits: { increment: walletCharge },
    },
  });
}

export async function settleUsageReservation(input: {
  reservationId?: string;
  reservationKey?: string;
  userId: string;
  requestType: string;
  selectedModels: string[];
  inputCharCount: number;
  inputTokenCount: number;
  outputTokenCount: number;
  estimatedCostUsd: number;
  creditsUsed?: number;
}) {
  const reservationWhere = input.reservationId
    ? { id: input.reservationId }
    : input.reservationKey
      ? { reservationKey: input.reservationKey }
      : null;

  if (!reservationWhere) {
    throw new Error("A usage reservation reference is required.");
  }

  const { user, userSubscription } = await getUserUsageProfile(input.userId);
  const policy = resolvePolicy({
    profile: user,
    hasLegacySubscription: hasActiveSubscription({
      isLifetime: userSubscription?.isLifetime ?? false,
      planEndsAt: userSubscription?.planEndsAt ?? null,
    }),
    couponDailyLimit: userSubscription?.couponDailyLimit ?? null,
    couponLimitEndsAt: userSubscription?.couponLimitEndsAt ?? null,
    couponLimitIsLifetime: userSubscription?.couponLimitIsLifetime ?? false,
  });

  await withSerializableRetries(() =>
    prisma.$transaction(
      async (tx) => {
        const reservation = await tx.usageReservation.findUnique({
          where: reservationWhere,
          include: {
            usageLimit: true,
          },
        });

        if (!reservation || reservation.userId !== input.userId) {
          throw new Error("Usage reservation was not found.");
        }

        if (reservation.status === "settled") {
          return reservation;
        }

        if (reservation.status === "released") {
          return reservation;
        }

        const actualCostUsd =
          input.estimatedCostUsd > 0
            ? input.estimatedCostUsd
            : Number(reservation.estimatedCostUsd);
        const computedCredits =
          input.creditsUsed ?? costUsdToCredits(actualCostUsd);
        const approvedCredits =
          reservation.maxApprovedCredits ||
          reservation.reservedCreditCount ||
          computedCredits;
        const creditsUsed = Math.max(
          0,
          Math.min(computedCredits || approvedCredits, approvedCredits),
        );

        await applyCreditCharge(tx, {
          userId: input.userId,
          policy,
          creditsUsed,
          now: new Date(),
        });

        await tx.usageLimit.update({
          where: { id: reservation.usageLimitId },
          data: {
            dailyRequestUsed: {
              increment: reservation.reservedRequestCount,
            },
          },
        });

        await tx.usageLog.create({
          data: {
            userId: input.userId,
            requestType: input.requestType,
            selectedModels: input.selectedModels,
            planTypeSnapshot: policy.planType,
            billingTypeSnapshot: policy.billingType,
            isBoostSnapshot: policy.isBoostActive,
            inputCharCount: input.inputCharCount,
            inputTokenCount: input.inputTokenCount,
            outputTokenCount: input.outputTokenCount,
            requestCountCharged: reservation.reservedRequestCount,
            estimatedCostUsd: decimal(actualCostUsd),
            creditsUsed,
          },
        });

        await tx.usageReservation.update({
          where: { id: reservation.id },
          data: {
            status: "settled",
            settledAt: new Date(),
            settledCreditCount: creditsUsed,
          },
        });

        return reservation;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  return getUsageStatus(input.userId);
}

export async function releaseUsageReservation(input: {
  reservationId?: string;
  reservationKey?: string;
  userId: string;
}) {
  const reservationWhere = input.reservationId
    ? { id: input.reservationId }
    : input.reservationKey
      ? { reservationKey: input.reservationKey }
      : null;

  if (!reservationWhere) {
    throw new Error("A usage reservation reference is required.");
  }

  await prisma.$transaction(async (tx) => {
    const reservation = await tx.usageReservation.findUnique({
      where: reservationWhere,
    });

    if (!reservation || reservation.userId !== input.userId) {
      return;
    }

    if (reservation.status !== "reserved") {
      return;
    }

    await tx.usageReservation.update({
      where: { id: reservation.id },
      data: {
        status: "released",
        releasedAt: new Date(),
      },
    });
  });

  return getUsageStatus(input.userId);
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
    const creditsUsed = input.creditsUsed ?? costUsdToCredits(input.estimatedCostUsd);

    await applyCreditCharge(tx, {
      userId: input.userId,
      policy: context.policy,
      creditsUsed,
      now: new Date(),
    });

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
        creditsUsed,
      },
    });

    return usage;
  });

  return toSummary(context.policy, updatedUsage.dailyRequestUsed, 0);
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
