-- Supabase Auth integration.
--
-- This migration is additive only: no existing column is dropped, no
-- existing row is touched, and no existing foreign key changes target.
-- `"User".id` (cuid) remains the FK target for every pre-existing table
-- (Coupon, CouponRedemption, UserSubscription, Project, ...).
--
-- What this does:
--   1. Lets "User" rows link to a Supabase Auth identity (supabaseUserId),
--      and makes passwordHash optional since Supabase-authenticated users
--      have no local password hash.
--   2. Adds three new, RLS-protected tables that key off auth.users(id)
--      directly: profiles (requirement 8/9), billing_customers and
--      subscriptions (requirement 10, forward-looking Paddle/Stripe design).
--   3. Adds the trigger that auto-creates a `profiles` row whenever
--      Supabase Auth creates a new auth.users row (requirement 8).
--
-- This does NOT enable RLS on the 36 pre-existing app tables (User,
-- Coupon, UserSubscription, ...). See docs/AUTH_SETUP.md for that optional,
-- separately-reviewed hardening script.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Bridge column on the existing User table --------------------------

ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "supabaseUserId" UUID;

CREATE UNIQUE INDEX "User_supabaseUserId_key" ON "User"("supabaseUserId");

ALTER TABLE "User"
  ADD CONSTRAINT "User_supabaseUserId_fkey"
  FOREIGN KEY ("supabaseUserId") REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. New Supabase-native tables ------------------------------------------

CREATE TABLE "profiles" (
    "user_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE "billing_customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_customers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "billing_customers_user_id_key" UNIQUE ("user_id"),
    CONSTRAINT "billing_customers_provider_customer_id_key" UNIQUE ("provider", "customer_id"),
    CONSTRAINT "billing_customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "billing_customer_id" UUID,
    "provider" TEXT NOT NULL,
    "provider_subscription_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "plan_id" TEXT,
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "subscriptions_provider_provider_subscription_id_key" UNIQUE ("provider", "provider_subscription_id"),
    CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT "subscriptions_billing_customer_id_fkey" FOREIGN KEY ("billing_customer_id") REFERENCES "billing_customers"("id") ON DELETE SET NULL
);

CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions"("user_id");

-- 3. RLS: authenticated users may read only their own row. All writes go
--    through the service role (server-side) or the trigger below, both of
--    which bypass RLS — no insert/update/delete policy is defined here.

ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON "profiles" TO authenticated;
GRANT SELECT ON "billing_customers" TO authenticated;
GRANT SELECT ON "subscriptions" TO authenticated;

CREATE POLICY "profiles_select_own" ON "profiles"
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "billing_customers_select_own" ON "billing_customers"
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "subscriptions_select_own" ON "subscriptions"
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- 4. Auto-create a profile row for every new Supabase Auth user -----------
--
-- Deliberately minimal: this only populates `profiles`. It does NOT try to
-- create/link the legacy "User" row (welcome-credit bootstrap, coupon
-- history, etc.) — that requires app-level business logic and is handled by
-- ensureLegacyUserLinked() in src/lib/supabase/link-legacy-user.ts, called
-- the first time a session is resolved server-side.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name, role, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'user',
    now()
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM authenticated;
