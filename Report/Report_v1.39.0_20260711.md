# Security Launch Hardening Report v1.39.0 (2026-07-11)

## Result

The phase-2 hardening implementation is complete in the isolated branch. The application is not yet production-approved until deployment secrets, the database migration, and live verification gates below are completed.

## Implemented

- Production env guard now requires independent strong `APP_SECRET` and `DB_ENCRYPTION_KEY`, TOTP, Upstash Redis, canonical HTTPS URLs, and safe worker/OAuth configuration. Static MFA and email-based admin bootstrap are rejected.
- Auth mutations require same-origin requests. Internal redirect targets reject schemes, backslashes, control characters, encoded separators, and prefix confusion. Handoff bearer values are submitted in a no-store POST form and consumed atomically once.
- Production auth/admin/trial cookies use `__Host-` names with short-lived admin sessions. Google OAuth refuses silent email-only account linking. Trial access requires an HttpOnly browser proof token in addition to the IP abuse signal.
- Share links are SHA-256 hashed at rest, expire after 30 days, support revocation and result-only scope, and deny the historical compromised token fingerprint. Existing links are converted by `20260711130000_security_launch_phase2`.
- Proxy CSP uses a per-request nonce and strict dynamic script policy. Public design prototypes and admin screenshots were removed from the production tree.
- Admin RBAC is enforced server-side; viewer roles are read-only, critical mutations require `SUPER_ADMIN`, and audit details are redacted. Provider/model validation, output caps, fail-closed pricing, distributed rate limiting, bounded worker bodies, provider lease timeout/serialization, and public error redaction were added.

## Verification performed

- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with two pre-existing unused-parameter warnings.
- Security regression set through `tsx --test`: 20 passed.
- `npx prisma validate` with non-secret dummy URLs: passed.
- `npm audit --omit=dev --audit-level=high`: no high/critical findings; two moderate PostCSS findings remain inside Next 16.2.10's nested dependency and require an upstream Next release.

## Required launch gates

1. Set real values in the deployment secret store for all env-guard requirements, including Upstash Redis and `ADMIN_TOTP_SECRET`; never commit or print them.
2. Apply the Prisma migration against a backup and verify the compromised share URL returns 404, a newly issued session link expires/revokes correctly, and result-only links return only the selected result.
3. Deploy the committed HEAD, then verify live headers/CSP nonce, `/api/auth/health` returns only `{ "ok": true }`, `/design-concepts/**` is 404, unsafe handoff redirects are rejected, and cross-origin mutations return 403.
4. Run a clean install/build and a full-history secret scan. Rotate any credential that appeared in old Git logs or screenshots; history rewriting is a separate repository-owner operation.

## Residual design work

Existing user prompts/results still have legacy plaintext columns beside application ciphertext. The next data-at-rest phase should backfill an envelope-keyed encrypted DTO, remove plaintext columns, and add current/previous key IDs for rotation. Attachments should ultimately move to private object storage with signed upload tokens and isolated parsing workers.
