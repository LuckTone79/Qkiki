-- Extend coupon and subscription enums for launch credit billing.
ALTER TYPE "CouponType" ADD VALUE 'WEEKLY_CREDIT';
ALTER TYPE "SubscriptionType" ADD VALUE 'WEEKLY_CREDIT_7D';

-- Credit coupon issue/redemption audit fields.
ALTER TABLE "Coupon" ADD COLUMN "creditAmount" INTEGER;
ALTER TABLE "CouponRedemption" ADD COLUMN "creditAmount" INTEGER;
ALTER TABLE "CouponRedemption" ADD COLUMN "creditExpiresAt" TIMESTAMP(3);

-- Active weekly coupon credit balance. Monthly plan credits remain implicit via UsageLog aggregation.
ALTER TABLE "UserSubscription" ADD COLUMN "couponCreditBalance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UserSubscription" ADD COLUMN "couponCreditEndsAt" TIMESTAMP(3);

-- Reservation-time credit quote and settlement trace.
ALTER TABLE "UsageReservation" ADD COLUMN "reservedCreditCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UsageReservation" ADD COLUMN "settledCreditCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UsageReservation" ADD COLUMN "estimatedCostUsd" DECIMAL(10,6) NOT NULL DEFAULT 0;
ALTER TABLE "UsageReservation" ADD COLUMN "maxApprovedCredits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UsageReservation" ADD COLUMN "pricingVersion" TEXT;
ALTER TABLE "UsageReservation" ADD COLUMN "quoteJson" TEXT;
