# Production launch gate

## Current state

The security/Auth implementation is committed on
`codex/security-launch-hardening-phase2-20260711` (`099ff21`) and pushed to
GitHub. Local verification is green: security tests 24/24, TypeScript, Prisma
generation, lint, and production build.

The live `https://yapp.wideget.net` deployment has not yet received this
commit. The live `/api/auth/health` response still contains legacy diagnostic
fields, so it must not be treated as the hardened release.

## Required production variables

Set these in Vercel **Production** before deploying:

- `ADMIN_TOTP_SECRET` — a unique Base32 TOTP secret, stored only in Vercel and
  the administrator's authenticator.
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

The retired `ADMIN_MFA_CODE` and legacy Google OAuth variables were removed
from Vercel Production. Do not re-add them.

## Final verification

```powershell
vercel env ls production
vercel deploy --prod --yes
curl.exe -sS -D - https://yapp.wideget.net/api/auth/health
curl.exe -sS -D - https://yapp.wideget.net/ -o NUL
```

The health body must be exactly `{"ok":true}` or `{"ok":false}` with no
diagnostic keys, and the response must include CSP, HSTS, nosniff, and
same-origin security headers. Confirm admin sign-in requires a valid TOTP and
that repeated auth requests receive `429` with `Retry-After`.
