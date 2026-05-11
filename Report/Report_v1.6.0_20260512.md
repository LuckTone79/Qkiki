# Report v1.6.0 (2026-05-12)

## Summary
- Added 4 admin coupon variants:
  - 30-day free (daily unlimited)
  - 30-day free (daily 50)
  - lifetime free (daily unlimited)
  - lifetime free (daily 50)
- Connected coupon redemption to effective daily usage policy.
- Added monthly per-user token/cost usage table for admin dashboard.
- Added per-user recent usage log table on admin user detail.

## DB / Migration
- Added `CouponType` enum values:
  - `MONTHLY_FREE_30D_DAILY_50`
  - `LIFETIME_FREE_DAILY_50`
- Extended `UserSubscription`:
  - `couponDailyLimit Int?`
  - `couponLimitEndsAt DateTime?`
  - `couponLimitIsLifetime Boolean @default(false)`
- Migration:
  - `prisma/migrations/20260512090000_add_coupon_daily_limit_variants/migration.sql`

## Backend
- Coupon redemption now writes coupon limit entitlement into `UserSubscription`.
- Usage policy now applies coupon-based daily limit override during active subscription window.
- Unlimited daily coupons are treated as a very high internal limit and exposed in UI as unlimited.

## Admin UI
- Coupon create form now supports 4 types.
- Dashboard now includes monthly per-user token/cost usage table (input/output tokens + USD estimate).
- User detail includes recent request logs with provider/model/tokens/cost.

## Verification
- `npm run db:generate`: passed
- `npm run lint`: passed
- `npm run build`: passed
