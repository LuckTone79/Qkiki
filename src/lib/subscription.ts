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

export function generateCouponCode(type: CouponType) {
  const prefixMap: Record<CouponType, string> = {
    MONTHLY_FREE_30D: "M30",
    MONTHLY_FREE_30D_DAILY_50: "M30-50",
    LIFETIME_FREE: "LIFE",
    LIFETIME_FREE_DAILY_50: "LIFE-50",
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

export async function getUserSubscriptionState(userId: string) {
  const subscription = await prisma.userSubscription.findUnique({
    where: { userId },
  });

  return {
    isLifetime: subscription?.isLifetime ?? false,
    planEndsAt: subscription?.planEndsAt ?? null,
  };
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
