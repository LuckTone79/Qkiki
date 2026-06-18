-- Unify billing on credits.
--
-- 1) Add credit-only coupon types (7-day / 30-day, fixed amount or unlimited).
--    Old count/free-based types are retained for backward compatibility with
--    any already-issued coupons but are no longer offered for new coupons.
ALTER TYPE "CouponType" ADD VALUE IF NOT EXISTS 'CREDIT_7D';
ALTER TYPE "CouponType" ADD VALUE IF NOT EXISTS 'CREDIT_30D';
ALTER TYPE "CouponType" ADD VALUE IF NOT EXISTS 'UNLIMITED_7D';
ALTER TYPE "CouponType" ADD VALUE IF NOT EXISTS 'UNLIMITED_30D';

-- 2) Period-based "unlimited credits" grant expiry.
ALTER TABLE "UserSubscription"
  ADD COLUMN IF NOT EXISTS "couponUnlimitedUntil" TIMESTAMP(3);
