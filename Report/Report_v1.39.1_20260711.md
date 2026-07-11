# Release Report v1.39.1 — 2026-07-11

## Scope

- Reconciled the Supabase Auth integration with the launch security hardening branch.
- Preserved strict production environment validation, TOTP admin MFA, distributed rate limiting, same-origin mutation checks, nonce CSP, and safe error responses.
- Removed legacy handoff/Google auth routes that bypassed the Supabase session model.

## Verification

- `npm run test:security` — 24/24 passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with two pre-existing unused-variable warnings.
- `npx prisma format` and `npx prisma generate` — passed.
- Production-mode `npm run build` — passed.
- Current-tree secret scan configuration remains enabled; historical findings require a separate history rewrite/credential rotation procedure.

## Release gate

Production deployment remains gated until the Vercel project has user-owned `ADMIN_TOTP_SECRET`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN` configured, and the legacy static `ADMIN_MFA_CODE` is removed. No secret values are stored in this repository or report.
