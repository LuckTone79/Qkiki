import "server-only";

import { BillingType, PlanType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasActiveSubscription } from "@/lib/access-policy";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const RESERVATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
    pendingReservedRequests: number;
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
    },
  });
}

function toSummary(
  policy: ResolvedUsagePolicy,
  dailyUsedCommitted: number,
  pendingReserved = 0,
): UsageStatusSummary {
  const dailyUsed = dailyUsedCommitted + pendingReserved;
  const remaining = Math.max(0, policy.dailyLimit - dailyUsed);

  return {
    ...policy,
    resetAt: policy.resetAt.toISOString(),
    dailyUsed,
    remaining,
    warningThresholdReached:
      policy.dailyLimit > 0 ? dailyUsed / policy.dailyLimit >= 0.8 : false,
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
  return toSummary(
    policy,
    usage.dailyRequestUsed,
    pending._sum.reservedRequestCount ?? 0,
  );
}

export async function requireUsageAccess(input: {
  userId: string;
  inputCharCount: number;
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
  const pendingReservedRequests = pending._sum.reservedRequestCount ?? 0;
  const summary = toSummary(
    policy,
    usage.dailyRequestUsed,
    pendingReservedRequests,
  );

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
      pendingReservedRequests,
    },
  } satisfies UsageCheckContext;
}

export async function reserveUsage(input: {
  userId: string;
  requestType: string;
  inputCharCount: number;
  reservationKey: string;
  context?: UsageCheckContext;
}) {
  const context =
    input.context ??
    (await requireUsageAccess({
      userId: input.userId,
      inputCharCount: input.inputCharCount,
    }));

  const summary = toSummary(
    context.policy,
    context.usage.dailyRequestUsed,
    context.usage.pendingReservedRequests,
  );

  if (summary.isLimitReached) {
    throw new UsageLimitReachedError(summary);
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
          },
        });
        const pendingReservedRequests = pending._sum.reservedRequestCount ?? 0;
        const effectiveSummary = toSummary(
          context.policy,
          usage.dailyRequestUsed,
          pendingReservedRequests,
        );

        if (effectiveSummary.isLimitReached) {
          throw new UsageLimitReachedError(effectiveSummary);
        }

        return tx.usageReservation.create({
          data: {
            reservationKey: input.reservationKey,
            userId: input.userId,
            usageLimitId: usage.id,
            requestType: input.requestType,
            inputCharCount: input.inputCharCount,
            reservedRequestCount: 1,
            status: "reserved",
            expiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
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
            estimatedCostUsd: decimal(input.estimatedCostUsd),
            creditsUsed: input.creditsUsed ?? 0,
          },
        });

        await tx.usageReservation.update({
          where: { id: reservation.id },
          data: {
            status: "settled",
            settledAt: new Date(),
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
