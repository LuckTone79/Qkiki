# Report v1.32.8-20260619

## Summary
- Reinforced Yapp canonical-domain handling after production verification showed `qkiki.wideget.net` still served static pages directly.
- Added `qkiki.wideget.net` to the legacy host fallback used by runtime canonical redirects when proxy environment variables are unavailable.
- Expanded `next.config.ts` host redirects so both `qkiki.vercel.app` and `qkiki.wideget.net` redirect to `https://yapp.wideget.net` before filesystem/static route serving.

## Branding Guardrail
- The product-facing brand remains Yapp.
- `qkiki` remains only in legacy domains, operational identifiers, cookies, storage keys, database/runtime identifiers, and compatibility paths.

## Verification
- `node --test src\lib\canonical-host.test.mjs` first failed on the missing-env `qkiki.wideget.net` redirect case before the fix.
- `node --test src\lib\canonical-host.test.mjs src\lib\workbench-maintenance-policy.test.mjs` passed: 18 tests.
- `npx tsc -p tsconfig.json --noEmit` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `.next/routes-manifest.json` includes host redirects for both `qkiki.vercel.app` and `qkiki.wideget.net`.
- `git diff --check` passed with line-ending warnings only.
- `npx playwright test` completed; the existing workbench smoke test was skipped because local `DATABASE_URL` is not configured.
