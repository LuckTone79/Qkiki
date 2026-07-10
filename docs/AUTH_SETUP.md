# Auth Setup — Supabase Auth

Yapp's authentication is implemented on **Supabase Auth**, backed by the same
Postgres database Prisma already uses (`db.xoxnkezwrrbwkdjlupkp.supabase.co`,
project `qkiki`). This document lists every environment variable and every
Supabase Dashboard setting required to run it, plus the one-time rollout
steps for migrating existing users.

## Current production setup status (2026-07-10)

Completed:
- Supabase project: `qkiki` / `xoxnkezwrrbwkdjlupkp`.
- Production DB migrations are applied and recorded in Prisma:
  - `20260707120000_supabase_auth`
  - `20260710120000_harden_supabase_auth_table_grants`
- `profiles`, `billing_customers`, and `subscriptions` have RLS enabled.
  Only the `authenticated` PostgREST role has table-level `SELECT`, and each
  policy restricts reads to `(select auth.uid()) = user_id`.
- Auth URL Configuration is set:
  - Site URL: `https://yapp.wideget.net`
  - Redirect URLs: `https://yapp.wideget.net/auth/callback`,
    `http://localhost:3000/auth/callback`
- Email provider is enabled, email confirmation is enabled, leaked-password
  protection is enabled, and Supabase minimum password length is set to `8`.
- Vercel Production has `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Still required before calling the auth rollout complete:
- Configure Google and Kakao providers in Supabase after obtaining provider
  credentials from Google Cloud Console and Kakao Developers.
- Create a Cloudflare Turnstile widget, set `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
  in Vercel, and enter the Turnstile secret in Supabase Attack Protection.
- Configure custom SMTP in Supabase before inviting the existing users. The
  current shared-mailer rate limit is only `2` emails/hour.
- Add `SUPABASE_SERVICE_ROLE_KEY` to local/Vercel secret storage before
  running `npm run auth:migrate-legacy-users -- --send`.
- Run the existing-user migration; currently the legacy `"User"` rows are not
  linked to `auth.users` yet.

## 1. Architecture overview

- **Identity**: Supabase Auth (`auth.users`) owns credentials, sessions, and
  OAuth/email flows. The app never stores a password for real users anymore.
- **Legacy bridge**: all existing app data (coupons, subscriptions, credits,
  projects, admin roles, ...) stays on the pre-existing `"User"` table, keyed
  by its original `cuid` id — nothing there changed. A new nullable
  `"User"."supabaseUserId"` column links each legacy row to its
  `auth.users.id`. [`ensureLegacyUserLinked()`](../src/lib/supabase/link-legacy-user.ts)
  resolves/creates that link on every request; every existing relation keeps
  working unmodified.
- **`profiles` / `billing_customers` / `subscriptions`**: new, RLS-protected
  tables that key directly off `auth.users.id` (uuid). `profiles` is
  auto-populated by a Postgres trigger on `auth.users` insert (requirement
  8/9). `billing_customers`/`subscriptions` are a forward-looking schema for
  the future Paddle/Stripe integration described in
  `docs/GLOBAL_MONETIZATION_GUIDE_2026-06-12.md` — nothing writes to them
  yet; the existing `UserSubscription`/`Coupon` system remains authoritative
  for billing until that integration ships.
- **Trial (anonymous) sessions** (`/api/trial/start`) are unchanged — they
  never had a real email and can't go through Supabase Auth, so they keep
  using the original DB-backed `AuthSession` cookie.
- **Admin** (`/admin/**`) now signs in through the same Supabase Auth session
  as regular users. Access is gated purely by `User.role`
  (`ADMIN`/`SUPER_ADMIN`/`SUPPORT_VIEWER`), checked fresh on every request in
  [`requireAdminViewer()`](../src/lib/admin-auth.ts). The old separate
  `AdminSession`/`ADMIN_MFA_CODE` mechanism is no longer used by the app (see
  §6 if you want to keep a second factor for admins).
- **Route protection**: `proxy.ts` (project root — Next.js 16 renamed
  `middleware.ts` to `proxy.ts`) refreshes the Supabase session cookie on
  every request and redirects signed-out visitors away from `/app/**`.
  Role-specific checks (admin, paid feature) happen server-side in the
  page/layout, not in proxy, since those need a real DB lookup.

## 2. Environment variables

| Variable | Where it's used | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | `https://xoxnkezwrrbwkdjlupkp.supabase.co` for this project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Publishable key. Dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Never expose to the client. Required before running `scripts/migrate-legacy-users-to-supabase.mjs` or any future admin-only Supabase operation |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | client | Cloudflare Turnstile widget's public site key. Leave empty only while CAPTCHA protection is not enabled in Supabase. |
| `INITIAL_ADMIN_EMAILS` | server | Unchanged — comma-separated emails that get `SUPER_ADMIN` on first sign-up |
| ~~`GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI`~~ | — | No longer read by the app. Google OAuth is now configured entirely in the Supabase Dashboard (§4). Safe to remove from Vercel. |
| ~~`ADMIN_MFA_CODE`~~ | — | No longer read by the app (§1). Safe to remove from Vercel. |

The Turnstile **secret** key is never an app env var — it's entered directly
into the Supabase Dashboard (§5), which verifies the token server-side
before your app ever sees the signup/signin request.

## 3. Supabase Dashboard — URL configuration

**Authentication → URL Configuration**
- **Site URL**: `https://yapp.wideget.net`
- **Redirect URLs** (allowlist), add:
  - `https://yapp.wideget.net/auth/callback`
  - `http://localhost:3000/auth/callback` (local dev)
  - Add any preview domain you actually use (e.g. `https://yapp.vercel.app/auth/callback`) if OAuth is tested there.

## 4. OAuth providers

**Authentication → Sign In / Providers → Google**
1. Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application).
2. Authorized redirect URI: `https://xoxnkezwrrbwkdjlupkp.supabase.co/auth/v1/callback`
3. Paste the Client ID / Client Secret into the Supabase Dashboard and enable the provider.

**Authentication → Sign In / Providers → Kakao**
1. [Kakao Developers](https://developers.kakao.com/) → create an app → Product settings → Kakao Login → enable it.
2. Redirect URI: `https://xoxnkezwrrbwkdjlupkp.supabase.co/auth/v1/callback`
3. Use the app's **REST API key** as the Client ID and the **Client Secret Code** (Security tab) as the Client Secret in Supabase.
4. Request at minimum the `account_email` consent item (Kakao Login → Consent Items) — Supabase needs an email to create/match the account.

Both providers are called from the app via `/api/auth/oauth/google` and
`/api/auth/oauth/kakao` (same-origin routes that redirect into Supabase's
authorize endpoint — kept same-origin so the "open in system browser" flow
for in-app browsers like KakaoTalk/Instagram still works).

## 5. Cloudflare Turnstile (bot protection)

**Authentication → Attack Protection → Enable CAPTCHA protection**
1. Create a Turnstile widget in the [Cloudflare dashboard](https://dash.cloudflare.com/) (Turnstile → Add site), domain = `yapp.wideget.net` (add `localhost` too for dev).
2. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to the widget's **site key**.
3. In Supabase, enable CAPTCHA protection, choose **Turnstile**, and paste the widget's **secret key**.

This protects sign-up **and** sign-in **and** password-recovery uniformly —
Supabase enforces the captcha token on all three endpoints once enabled, so
the app renders the Turnstile widget on all three forms (`AuthForm`,
`ForgotPasswordForm`, `AdminAuthForm`) to match.

## 6. Rate limits

**Authentication → Rate Limits** (Dashboard). Defaults are conservative and
shared across the whole project — during testing this repo's sign-up flow
hit the default email limit after two attempts. Recommended production
values:

| Limit | Default | Recommended |
|---|---|---|
| Emails per hour | 2 (current shared mailer setting) | Configure **custom SMTP** (below) — removes this ceiling |
| Sign-up / sign-in requests | 30 / 5 min / IP | Keep default; raise only if you see false positives from legitimate shared-IP traffic (corporate NAT, mobile carrier) |
| Token refresh requests | 150 / 5 min / IP | Keep default |
| OTP / magic-link requests | 30 / hour | Keep default (not used by this app's flows) |

**Strongly recommended for production**: configure a **custom SMTP**
provider (Authentication → SMTP Settings — e.g. Resend, Postmark, SES).
Supabase's built-in mailer is meant for development/low-volume use and is
rate-limited per-project; a custom SMTP provider removes that ceiling and
improves deliverability for confirmation/reset/invite emails.

## 7. Migrating existing users

Existing accounts (in the legacy `"User"` table) don't exist in
`auth.users` yet and can't self-serve a "forgot password" (Supabase won't
send a recovery email for an address it has no record of). Run the
migration script when ready:

```bash
# Dry run — lists who would be migrated, sends nothing
npm run auth:migrate-legacy-users

# Actually create Supabase accounts + send "set your password" invite emails
npm run auth:migrate-legacy-users -- --send

# Stage the rollout (e.g. respect email rate limits, or test on a few users first)
npm run auth:migrate-legacy-users -- --send --limit 10
```

For each unmigrated user this creates a matching `auth.users` row
(email pre-confirmed, since it was already verified under the old system),
stamps `"User"."supabaseUserId"`, and sends a Supabase "invite" email with a
link to `/reset-password`. Configure custom SMTP (§6) before running this
against all ~59 existing users, or stage it with `--limit`.

`scripts/reset-password.mjs` (`npm run user:reset-password`) is now
superseded by this flow and by the self-serve `/forgot-password` page — it
still runs, but resetting `"User"."passwordHash"` no longer changes what a
real user can sign in with.

## 8. Optional: RLS hardening for pre-existing tables

This migration enables Row Level Security on the three new tables
(`profiles`, `billing_customers`, `subscriptions`) only, plus the follow-up
grant hardening migration that removes `anon`/`PUBLIC` table access from
those three tables. The pre-existing app tables (`User`, `Coupon`,
`UserSubscription`, `Project`, ...) still have RLS **disabled**. The app
itself never hits them through PostgREST (Prisma connects directly as a
privileged Postgres role, which bypasses RLS), but review this before exposing
broader Data API access with the publishable key. If you want a strict
default-deny Data API posture for those existing tables, review and run:

```sql
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuthAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuthSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WorkbenchSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WorkflowStep" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Result" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SessionAttachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ResultAttachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TrialAccess" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Preset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AdminSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AdminAuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AdminContentAccessLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Coupon" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CouponRedemption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."UserSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SubscriptionLedger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AdminProviderConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AdminSystemSetting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."UsageLimit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."UsageLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CreditWallet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PaymentPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ExecutionRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."UsageReservation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProviderLease" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ExecutionRunStep" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SharedLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."FeedbackPost" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."FeedbackComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."FeedbackAttachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ParallelComparison" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProjectItem" ENABLE ROW LEVEL SECURITY;
```

(`public._prisma_migrations` intentionally excluded — Prisma needs to read/write it directly.)

## 9. What changed in the codebase (reference)

| Old | New |
|---|---|
| `src/app/api/auth/sign-up`, `sign-in` routes | Removed — `AuthForm` calls `supabase.auth.signUp` / `signInWithPassword` directly |
| `src/app/api/auth/google/{start,callback}`, `src/lib/google-oauth.ts` | Removed — `src/app/api/auth/oauth/[provider]/route.ts` + `src/app/auth/callback/route.ts` |
| `src/lib/auth.ts` (`AuthSession`-cookie based) | Rewritten — Supabase session first, legacy cookie fallback for trial users only |
| `src/lib/admin-auth.ts` (`AdminSession` + MFA) | Rewritten — derives from `getCurrentUser()` + `User.role` |
| — | New: `src/lib/supabase/{client,server,admin,proxy,env}.ts`, `src/lib/supabase/link-legacy-user.ts` |
| — | New pages: `/forgot-password`, `/reset-password` |
| `proxy.ts` (project root) | Adds Supabase session refresh alongside its existing canonical-host/admin-subdomain/`/app` gating |
