import "server-only";

import crypto from "crypto";
import {
  CouponRedemptionResult,
  CouponType,
  Prisma,
  SubscriptionEventType,
  SubscriptionType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
// "Lifetime" grants use a far-future expiry (~100 years) so the existing
// expiry-based active checks treat them as never expiring.
const LIFETIME_MS = 100 * 365 * 24 * 60 * 60 * 1000;

function couponCreditDurationMs(type: CouponType) {
  if (type === CouponType.CREDIT_30D) return THIRTY_DAYS_MS;
  if (type === CouponType.CREDIT_LIFETIME) return LIFETIME_MS;
  return SEVEN_DAYS_MS;
}

function couponUnlimitedDurationMs(type: CouponType) {
  if (type === CouponType.UNLIMITED_30D) return THIRTY_DAYS_MS;
  if (type === CouponType.UNLIMITED_LIFETIME) return LIFETIME_MS;
  return SEVEN_DAYS_MS;
}

function couponDurationLabel(type: CouponType) {
  if (type === CouponType.CREDIT_30D || type === CouponType.UNLIMITED_30D) {
    return "30d";
  }
  if (
    type === CouponType.CREDIT_LIFETIME ||
    type === CouponType.UNLIMITED_LIFETIME
  ) {
    return "lifetime";
  }
  return "7d";
}
const COUPON_DEACTIVATED_NOTE = "coupon_deactivated_by_admin";
const COUPON_DELETED_NOTE = "coupon_deleted_by_admin";

export class CouponRedeemError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function addThirtyDays(date: Date) {
  return new Date(date.getTime() + THIRTY_DAYS_MS);
}

function addSevenDays(date: Date) {
  return new Date(date.getTime() + SEVEN_DAYS_MS);
}

export function generateCouponCode(type: CouponType) {
  const prefixMap: Record<CouponType, string> = {
    MONTHLY_FREE_30D: "M30",
    MONTHLY_FREE_30D_DAILY_50: "M30-50",
    LIFETIME_FREE: "LIFE",
    LIFETIME_FREE_DAILY_50: "LIFE-50",
    WEEKLY_CREDIT: "CR7",
    CREDIT_7D: "CR7",
    CREDIT_30D: "CR30",
    CREDIT_LIFETIME: "CRLIFE",
    UNLIMITED_7D: "UNL7",
    UNLIMITED_30D: "UNL30",
    UNLIMITED_LIFETIME: "UNLLIFE",
  };
  const prefix = prefixMap[type];
  const random = cryptoRandom(10);
  return `${prefix}-${random}`;
}

function cryptoRandom(length: number) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i += 1) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase();
}

// "Lifetime" grants are stored with a far-future expiry; treat anything past
// this threshold as permanent (no expiry date shown).
const LIFETIME_DATE_THRESHOLD = new Date("2100-01-01T00:00:00Z").getTime();

function describeExpiry(date: Date | null | undefined) {
  if (!date) {
    return { expiresAt: null as string | null, isLifetime: false };
  }
  if (date.getTime() >= LIFETIME_DATE_THRESHOLD) {
    return { expiresAt: null as string | null, isLifetime: true };
  }
  return { expiresAt: date.toISOString(), isLifetime: false };
}

export async function getUserSubscriptionState(userId: string) {
  const now = new Date();
  const [subscription, latestCouponEvent, latestAppliedRedemption] =
    await Promise.all([
      prisma.userSubscription.findUnique({
        where: { userId },
      }),
      // The most recent coupon ledger event of ANY kind. If it is a
      // deactivation/deletion the coupon is currently disabled; a newer
      // redemption clears that state.
      prisma.subscriptionLedger.findFirst({
        where: {
          userId,
          eventType: SubscriptionEventType.COUPON_REDEMPTION,
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, note: true },
      }),
      prisma.couponRedemption.findFirst({
        where: {
          userId,
          result: {
            in: [
              CouponRedemptionResult.APPLIED,
              CouponRedemptionResult.ALREADY_LIFETIME,
            ],
          },
        },
        orderBy: { createdAt: "desc" },
        select: {
          grantStartAt: true,
          createdAt: true,
          coupon: { select: { type: true, creditAmount: true } },
        },
      }),
    ]);

  const couponStatus =
    latestCouponEvent?.note === COUPON_DEACTIVATED_NOTE ||
    latestCouponEvent?.note === COUPON_DELETED_NOTE
      ? "DEACTIVATED"
      : null;

  const unlimitedActive = Boolean(
    subscription?.couponUnlimitedUntil &&
      subscription.couponUnlimitedUntil.getTime() > now.getTime(),
  );
  const creditActive = Boolean(
    (subscription?.couponCreditBalance ?? 0) > 0 &&
      subscription?.couponCreditEndsAt &&
      subscription.couponCreditEndsAt.getTime() > now.getTime(),
  );

  let activeCoupon: {
    kind: "credit" | "unlimited";
    type: CouponType | null;
    creditAmount: number | null;
    appliedAt: string | null;
    expiresAt: string | null;
    isLifetime: boolean;
  } | null = null;

  if (couponStatus !== "DEACTIVATED" && (unlimitedActive || creditActive)) {
    const appliedAt = (
      latestAppliedRedemption?.grantStartAt ??
      latestAppliedRedemption?.createdAt ??
      null
    )?.toISOString() ?? null;

    if (unlimitedActive) {
      const expiry = describeExpiry(subscription?.couponUnlimitedUntil);
      activeCoupon = {
        kind: "unlimited",
        type: latestAppliedRedemption?.coupon.type ?? null,
        creditAmount: null,
        appliedAt,
        expiresAt: expiry.expiresAt,
        isLifetime: expiry.isLifetime,
      };
    } else {
      const expiry = describeExpiry(subscription?.couponCreditEndsAt);
      activeCoupon = {
        kind: "credit",
        type: latestAppliedRedemption?.coupon.type ?? null,
        creditAmount: subscription?.couponCreditBalance ?? 0,
        appliedAt,
        expiresAt: expiry.expiresAt,
        isLifetime: expiry.isLifetime,
      };
    }
  }

  return {
    isLifetime: subscription?.isLifetime ?? false,
    planEndsAt: subscription?.planEndsAt ?? null,
    couponCreditBalance: subscription?.couponCreditBalance ?? 0,
    couponCreditEndsAt: subscription?.couponCreditEndsAt ?? null,
    couponUnlimitedUntil: subscription?.couponUnlimitedUntil ?? null,
    couponStatus,
    activeCoupon,
  };
}

function mapCouponTypeToSubscriptionType(type: CouponType) {
  if (type === CouponType.MONTHLY_FREE_30D || type === CouponType.MONTHLY_FREE_30D_DAILY_50) {
    return SubscriptionType.MONTHLY_FREE_30D;
  }

  if (type === CouponType.WEEKLY_CREDIT) {
    return SubscriptionType.WEEKLY_CREDIT_7D;
  }

  return SubscriptionType.LIFETIME_FREE;
}

export async function revokeCouponGrantForUserByAdmin(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    couponId: string;
    couponType: CouponType;
    reason: "deactivate" | "delete";
  },
) {
  const now = new Date();
  const note = input.reason === "delete" ? COUPON_DELETED_NOTE : COUPON_DEACTIVATED_NOTE;

  if (
    input.couponType === CouponType.WEEKLY_CREDIT ||
    input.couponType === CouponType.CREDIT_7D ||
    input.couponType === CouponType.CREDIT_30D ||
    input.couponType === CouponType.CREDIT_LIFETIME
  ) {
    await tx.userSubscription.updateMany({
      where: { userId: input.userId },
      data: {
        couponCreditBalance: 0,
        couponCreditEndsAt: null,
      },
    });

    await tx.subscriptionLedger.create({
      data: {
        userId: input.userId,
        couponId: input.couponId,
        eventType: SubscriptionEventType.COUPON_REDEMPTION,
        subscriptionType: SubscriptionType.WEEKLY_CREDIT_7D,
        startAt: now,
        endAt: now,
        isLifetime: false,
        note,
      },
    });
    return;
  }

  if (
    input.couponType === CouponType.UNLIMITED_7D ||
    input.couponType === CouponType.UNLIMITED_30D ||
    input.couponType === CouponType.UNLIMITED_LIFETIME
  ) {
    await tx.userSubscription.updateMany({
      where: { userId: input.userId },
      data: { couponUnlimitedUntil: null },
    });

    await tx.subscriptionLedger.create({
      data: {
        userId: input.userId,
        couponId: input.couponId,
        eventType: SubscriptionEventType.COUPON_REDEMPTION,
        subscriptionType: SubscriptionType.MONTHLY_FREE_30D,
        startAt: now,
        endAt: now,
        isLifetime: false,
        note,
      },
    });
    return;
  }

  await tx.userSubscription.updateMany({
    where: { userId: input.userId },
    data: {
      isLifetime: false,
      planEndsAt: null,
      couponDailyLimit: null,
      couponLimitEndsAt: null,
      couponLimitIsLifetime: false,
    },
  });

  await tx.subscriptionLedger.create({
    data: {
      userId: input.userId,
      couponId: input.couponId,
      eventType: SubscriptionEventType.COUPON_REDEMPTION,
      subscriptionType: mapCouponTypeToSubscriptionType(input.couponType),
      startAt: now,
      endAt: now,
      isLifetime: false,
      note,
    },
  });
}

export async function redeemCouponCode(input: { userId: string; couponCode: string }) {
  const couponCode = normalizeCouponCode(input.couponCode);

  if (!couponCode) {
    throw new CouponRedeemError("Coupon code is required.", 400);
  }

  return prisma.$transaction(async (tx) => {
    const coupon = await tx.coupon.findUnique({
      where: { code: couponCode },
    });

    if (!coupon) {
      throw new CouponRedeemError("Coupon code is invalid.", 404);
    }

    if (!coupon.isActive) {
      await tx.couponRedemption.create({
        data: {
          couponId: coupon.id,
          userId: input.userId,
          result: CouponRedemptionResult.INACTIVE,
          note: "inactive_coupon",
        },
      });
      throw new CouponRedeemError("Coupon is inactive.", 409);
    }

    if (coupon.redeemedAt) {
      await tx.couponRedemption.create({
        data: {
          couponId: coupon.id,
          userId: input.userId,
          result: CouponRedemptionResult.USED,
          note: "already_redeemed",
        },
      });
      throw new CouponRedeemError("Coupon already used.", 409);
    }

    const now = new Date();
    const claim = await tx.coupon.updateMany({
      where: {
        id: coupon.id,
        isActive: true,
        redeemedAt: null,
      },
      data: {
        redeemedAt: now,
        redeemedByUserId: input.userId,
      },
    });

    if (claim.count !== 1) {
      await tx.couponRedemption.create({
        data: {
          couponId: coupon.id,
          userId: input.userId,
          result: CouponRedemptionResult.USED,
          note: "redeem_race_lost",
        },
      });
      throw new CouponRedeemError("Coupon already used.", 409);
    }

    const current = await tx.userSubscription.findUnique({
      where: { userId: input.userId },
    });

    let redemptionResult: CouponRedemptionResult =
      CouponRedemptionResult.APPLIED;
    let note: string | null = null;
    let grantStartAt: Date | null = null;
    let grantEndAt: Date | null = null;
    let grantIsLifetime = false;
    let creditAmount: number | null = null;
    let creditExpiresAt: Date | null = null;

    if (coupon.type === CouponType.WEEKLY_CREDIT) {
      const amount = coupon.creditAmount ?? 0;
      if (amount < 1) {
        throw new CouponRedeemError("Credit coupon amount is invalid.", 409);
      }

      const activeExistingCredits =
        current?.couponCreditEndsAt &&
        current.couponCreditEndsAt.getTime() > now.getTime()
          ? current.couponCreditBalance
          : 0;
      const nextEnd = addSevenDays(now);
      const mergedEnd =
        current?.couponCreditEndsAt &&
        current.couponCreditEndsAt.getTime() > nextEnd.getTime()
          ? current.couponCreditEndsAt
          : nextEnd;

      await tx.userSubscription.upsert({
        where: { userId: input.userId },
        update: {
          couponCreditBalance: activeExistingCredits + amount,
          couponCreditEndsAt: mergedEnd,
        },
        create: {
          userId: input.userId,
          couponCreditBalance: amount,
          couponCreditEndsAt: nextEnd,
        },
      });

      await tx.subscriptionLedger.create({
        data: {
          userId: input.userId,
          couponId: coupon.id,
          eventType: SubscriptionEventType.COUPON_REDEMPTION,
          subscriptionType: SubscriptionType.WEEKLY_CREDIT_7D,
          startAt: now,
          endAt: mergedEnd,
          isLifetime: false,
          note: `weekly_credit_${amount}`,
        },
      });

      grantStartAt = now;
      grantEndAt = mergedEnd;
      creditAmount = amount;
      creditExpiresAt = mergedEnd;
    }

    if (
      coupon.type === CouponType.CREDIT_7D ||
      coupon.type === CouponType.CREDIT_30D ||
      coupon.type === CouponType.CREDIT_LIFETIME
    ) {
      const amount = coupon.creditAmount ?? 0;
      if (amount < 1) {
        throw new CouponRedeemError("Credit coupon amount is invalid.", 409);
      }

      const durationMs = couponCreditDurationMs(coupon.type);
      const activeExistingCredits =
        current?.couponCreditEndsAt &&
        current.couponCreditEndsAt.getTime() > now.getTime()
          ? current.couponCreditBalance
          : 0;
      const nextEnd = new Date(now.getTime() + durationMs);
      const mergedEnd =
        current?.couponCreditEndsAt &&
        current.couponCreditEndsAt.getTime() > nextEnd.getTime()
          ? current.couponCreditEndsAt
          : nextEnd;

      await tx.userSubscription.upsert({
        where: { userId: input.userId },
        update: {
          couponCreditBalance: activeExistingCredits + amount,
          couponCreditEndsAt: mergedEnd,
        },
        create: {
          userId: input.userId,
          couponCreditBalance: amount,
          couponCreditEndsAt: nextEnd,
        },
      });

      await tx.subscriptionLedger.create({
        data: {
          userId: input.userId,
          couponId: coupon.id,
          eventType: SubscriptionEventType.COUPON_REDEMPTION,
          subscriptionType: SubscriptionType.WEEKLY_CREDIT_7D,
          startAt: now,
          endAt: mergedEnd,
          isLifetime: coupon.type === CouponType.CREDIT_LIFETIME,
          note: `credit_${couponDurationLabel(coupon.type)}_${amount}`,
        },
      });

      grantStartAt = now;
      grantEndAt = mergedEnd;
      grantIsLifetime = coupon.type === CouponType.CREDIT_LIFETIME;
      creditAmount = amount;
      creditExpiresAt = mergedEnd;
    }

    if (
      coupon.type === CouponType.UNLIMITED_7D ||
      coupon.type === CouponType.UNLIMITED_30D ||
      coupon.type === CouponType.UNLIMITED_LIFETIME
    ) {
      const durationMs = couponUnlimitedDurationMs(coupon.type);
      const nextEnd = new Date(now.getTime() + durationMs);
      const mergedEnd =
        current?.couponUnlimitedUntil &&
        current.couponUnlimitedUntil.getTime() > nextEnd.getTime()
          ? current.couponUnlimitedUntil
          : nextEnd;

      await tx.userSubscription.upsert({
        where: { userId: input.userId },
        update: { couponUnlimitedUntil: mergedEnd },
        create: { userId: input.userId, couponUnlimitedUntil: nextEnd },
      });

      await tx.subscriptionLedger.create({
        data: {
          userId: input.userId,
          couponId: coupon.id,
          eventType: SubscriptionEventType.COUPON_REDEMPTION,
          subscriptionType: SubscriptionType.MONTHLY_FREE_30D,
          startAt: now,
          endAt: mergedEnd,
          isLifetime: coupon.type === CouponType.UNLIMITED_LIFETIME,
          note: `unlimited_${couponDurationLabel(coupon.type)}`,
        },
      });

      grantStartAt = now;
      grantEndAt = mergedEnd;
      grantIsLifetime = coupon.type === CouponType.UNLIMITED_LIFETIME;
    }

    if (
      coupon.type === CouponType.MONTHLY_FREE_30D ||
      coupon.type === CouponType.MONTHLY_FREE_30D_DAILY_50
    ) {
      if (current?.isLifetime) {
        redemptionResult = CouponRedemptionResult.ALREADY_LIFETIME;
        note = "already_lifetime";
        grantIsLifetime = true;
      } else {
        const baseStart =
          current?.planEndsAt && current.planEndsAt.getTime() > now.getTime()
            ? current.planEndsAt
            : now;
        const nextEnd = addThirtyDays(baseStart);

        const couponDailyLimit =
          coupon.type === CouponType.MONTHLY_FREE_30D_DAILY_50 ? 50 : null;
        await tx.userSubscription.upsert({
          where: { userId: input.userId },
          update: {
            isLifetime: false,
            planEndsAt: nextEnd,
            couponDailyLimit,
            couponLimitEndsAt: nextEnd,
            couponLimitIsLifetime: false,
          },
          create: {
            userId: input.userId,
            isLifetime: false,
            planEndsAt: nextEnd,
            couponDailyLimit,
            couponLimitEndsAt: nextEnd,
            couponLimitIsLifetime: false,
          },
        });

        await tx.subscriptionLedger.create({
          data: {
            userId: input.userId,
            couponId: coupon.id,
            eventType: SubscriptionEventType.COUPON_REDEMPTION,
            subscriptionType: SubscriptionType.MONTHLY_FREE_30D,
            startAt: baseStart,
            endAt: nextEnd,
            isLifetime: false,
            note:
              coupon.type === CouponType.MONTHLY_FREE_30D_DAILY_50
                ? "monthly_free_30d_daily_50"
                : "monthly_free_30d",
          },
        });

        grantStartAt = baseStart;
        grantEndAt = nextEnd;
      }
    }

    if (
      coupon.type === CouponType.LIFETIME_FREE ||
      coupon.type === CouponType.LIFETIME_FREE_DAILY_50
    ) {
      if (current?.isLifetime) {
        redemptionResult = CouponRedemptionResult.ALREADY_LIFETIME;
        note = "already_lifetime";
        grantIsLifetime = true;
      } else {
        const couponDailyLimit =
          coupon.type === CouponType.LIFETIME_FREE_DAILY_50 ? 50 : null;
        await tx.userSubscription.upsert({
          where: { userId: input.userId },
          update: {
            isLifetime: true,
            planEndsAt: null,
            couponDailyLimit,
            couponLimitEndsAt: null,
            couponLimitIsLifetime: true,
          },
          create: {
            userId: input.userId,
            isLifetime: true,
            planEndsAt: null,
            couponDailyLimit,
            couponLimitEndsAt: null,
            couponLimitIsLifetime: true,
          },
        });

        await tx.subscriptionLedger.create({
          data: {
            userId: input.userId,
            couponId: coupon.id,
            eventType: SubscriptionEventType.COUPON_REDEMPTION,
            subscriptionType: SubscriptionType.LIFETIME_FREE,
            startAt: now,
            endAt: null,
            isLifetime: true,
            note:
              coupon.type === CouponType.LIFETIME_FREE_DAILY_50
                ? "lifetime_free_daily_50"
                : "lifetime_free",
          },
        });

        grantStartAt = now;
        grantEndAt = null;
        grantIsLifetime = true;
      }
    }

    await tx.couponRedemption.create({
      data: {
        couponId: coupon.id,
        userId: input.userId,
        result: redemptionResult,
        note,
        grantStartAt,
        grantEndAt,
        grantIsLifetime,
        creditAmount,
        creditExpiresAt,
      },
    });

    const updated = await tx.userSubscription.findUnique({
      where: { userId: input.userId },
    });

    return {
      couponId: coupon.id,
      couponCode: coupon.code,
      couponType: coupon.type,
      result: redemptionResult,
      note,
      subscription: {
        isLifetime: updated?.isLifetime ?? false,
        planEndsAt: updated?.planEndsAt ?? null,
        couponCreditBalance: updated?.couponCreditBalance ?? 0,
        couponCreditEndsAt: updated?.couponCreditEndsAt ?? null,
      },
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function grantManualSubscription(input: {
  targetUserId: string;
  adminUserId: string;
  type: CouponType;
  note?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const current = await tx.userSubscription.findUnique({
      where: { userId: input.targetUserId },
    });

    if (input.type === "LIFETIME_FREE") {
      const alreadyLifetime = Boolean(current?.isLifetime);

      await tx.userSubscription.upsert({
        where: { userId: input.targetUserId },
        update: {
          isLifetime: true,
          planEndsAt: null,
          couponDailyLimit: null,
          couponLimitEndsAt: null,
          couponLimitIsLifetime: false,
        },
        create: {
          userId: input.targetUserId,
          isLifetime: true,
          planEndsAt: null,
          couponDailyLimit: null,
          couponLimitEndsAt: null,
          couponLimitIsLifetime: false,
        },
      });

      await tx.subscriptionLedger.create({
        data: {
          userId: input.targetUserId,
          grantedByAdminId: input.adminUserId,
          eventType: SubscriptionEventType.MANUAL_GRANT,
          subscriptionType: SubscriptionType.LIFETIME_FREE,
          startAt: now,
          endAt: null,
          isLifetime: true,
          note: input.note ?? (alreadyLifetime ? "already_lifetime" : "manual_lifetime"),
        },
      });

      return {
        result: alreadyLifetime ? "already_lifetime" : "applied",
        isLifetime: true,
        planEndsAt: null,
      };
    }

    if (current?.isLifetime) {
      await tx.subscriptionLedger.create({
        data: {
          userId: input.targetUserId,
          grantedByAdminId: input.adminUserId,
          eventType: SubscriptionEventType.MANUAL_GRANT,
          subscriptionType: SubscriptionType.MONTHLY_FREE_30D,
          startAt: now,
          endAt: null,
          isLifetime: true,
          note: input.note ?? "already_lifetime",
        },
      });

      return {
        result: "already_lifetime",
        isLifetime: true,
        planEndsAt: null,
      };
    }

    const baseStart =
      current?.planEndsAt && current.planEndsAt.getTime() > now.getTime()
        ? current.planEndsAt
        : now;
    const nextEnd = addThirtyDays(baseStart);

    await tx.userSubscription.upsert({
      where: { userId: input.targetUserId },
      update: {
        isLifetime: false,
        planEndsAt: nextEnd,
        couponDailyLimit: null,
        couponLimitEndsAt: null,
        couponLimitIsLifetime: false,
      },
      create: {
        userId: input.targetUserId,
        isLifetime: false,
        planEndsAt: nextEnd,
        couponDailyLimit: null,
        couponLimitEndsAt: null,
        couponLimitIsLifetime: false,
      },
    });

    await tx.subscriptionLedger.create({
      data: {
        userId: input.targetUserId,
        grantedByAdminId: input.adminUserId,
        eventType: SubscriptionEventType.MANUAL_GRANT,
        subscriptionType: SubscriptionType.MONTHLY_FREE_30D,
        startAt: baseStart,
        endAt: nextEnd,
        isLifetime: false,
        note: input.note ?? "manual_monthly_30d",
      },
    });

    return {
      result: "applied",
      isLifetime: false,
      planEndsAt: nextEnd,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
