-- Extend coupon types for daily-limit variants.
DO $$
BEGIN
  CREATE TYPE "CouponType" AS ENUM (
    'MONTHLY_FREE_30D',
    'LIFETIME_FREE',
    'MONTHLY_FREE_30D_DAILY_50',
    'LIFETIME_FREE_DAILY_50'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "CouponType" ADD VALUE IF NOT EXISTS 'MONTHLY_FREE_30D_DAILY_50';
ALTER TYPE "CouponType" ADD VALUE IF NOT EXISTS 'LIFETIME_FREE_DAILY_50';

-- Persist coupon-driven daily usage overrides on subscription state.
ALTER TABLE "UserSubscription"
ADD COLUMN IF NOT EXISTS "couponDailyLimit" INTEGER,
ADD COLUMN IF NOT EXISTS "couponLimitEndsAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "couponLimitIsLifetime" BOOLEAN NOT NULL DEFAULT false;
