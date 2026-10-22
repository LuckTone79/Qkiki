# Yapp Login Kit Integration Report

Version: `v1.36.5-20260922`
Date: 2026-09-22

## Scope

Integrated `@wideget/login-kit@0.1.0-alpha.2` as a Yapp app-local
authentication boundary. The existing Supabase Auth engine remains the
credential/session owner, and the existing Prisma `User.id` remains the domain
owner ID.

## Changes

- Pinned the exact Login Kit artifact in `wideget.auth.lock.json`:
  `d12e654f686cec8274b7bf50f591667bf6a9b192d828f3573e3309310e2a4f74`.
- Added Yapp-owned adapter/hooks under `auth/wideget/`.
- Added one provider registry for sign-in and sign-up. Email, Google, and
  Kakao are configured; Facebook, WhatsApp OTP, and Apple remain gated.
- Added a post-sign-in UUID-to-CUID bridge route and callback mapping.
- Added conflict/no-email guards so an existing linked account is never taken
  over and no synthetic email is created for phone-only identities.
- Left the public landing page `/` and anonymous trial flow unchanged.
- Bumped the app-visible version to `v1.36.5-20260922`.

## Verification

- Login Kit package tests: 34 passed.
- Supabase Auth settings read-only check: email, Google, Kakao enabled;
  Facebook, Apple, phone disabled.
- Login Kit `doctor --release-target local`: config, lock, artifact hash,
  managed file hash, and app-owned paths passed; provider E2E remained an
  external gate.
- Focused identity/registry tests: 6 passed; full Node test suite: 199 passed.
- TypeScript (`tsc --noEmit`), ESLint, and Next production build passed.
- Local browser smoke: `/` rendered the public Yapp landing page, `/sign-in`
  rendered email/Google/Kakao options, and `/app/workbench` redirected an
  unauthenticated browser to `/sign-in`.
- Production deployment smoke: `https://yapp.wideget.net/` returned 200 and
  rendered the landing page; `/sign-in` returned 200; `/app/workbench`
  returned 307 with `Location: /sign-in` and the browser reached the login
  screen. The `qkiki.vercel.app` alias redirected to the canonical host.
- Real-account/provider/inbox login E2E remains an external gate; no
  credentials or OTP/email were submitted.

## Data and external gates

No production DB migration, existing-user invite, provider secret change, or
email/OTP send was performed by this code change. Existing-user migration must
be staged separately after custom SMTP and test-account readiness are proven.
