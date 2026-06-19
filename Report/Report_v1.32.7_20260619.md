# Report v1.32.7-20260619

## Summary

- Re-verified that the current public brand is Yapp, while Vercel/GitHub/Supabase project identifiers can remain qkiki for operational safety.
- Fixed the canonical host policy so the legacy `qkiki.wideget.net` domain redirects to `yapp.wideget.net`.
- Added regression coverage to keep future optimization work from silently serving the legacy qkiki wideget host as a primary domain.

## Changes

- Updated `src/lib/canonical-host.ts` so `qkiki.wideget.net` is treated as a redirectable legacy host.
- Added `src/lib/canonical-host.test.mjs` coverage for:
  - `qkiki.wideget.net` browser-page redirect eligibility.
  - path/query preservation from `qkiki.wideget.net` to `yapp.wideget.net`.
- Bumped visible app version to `v1.32.7-20260619`.

## Verification

- `node --test src\lib\canonical-host.test.mjs` failed before the fix for `qkiki.wideget.net`, then passed after the fix with 13 tests.
- `node --test src\lib\canonical-host.test.mjs src\lib\workbench-maintenance-policy.test.mjs` passed with 17 tests.
- Source check confirmed visible Yapp branding remains in active UI/app code; remaining qkiki names are legacy or operational identifiers.
- `npx tsc -p tsconfig.json --noEmit` passed.
- `npm run lint` passed.
- `npm run build` passed and generated 57 static pages.
- `git diff --check` passed.
- `npx playwright test` passed with 1 skipped smoke test because this worktree has no `DATABASE_URL`.
- Pre-deploy live check reproduced the issue: `https://qkiki.wideget.net` returned 200 instead of redirecting to `https://yapp.wideget.net`.

## Known Notes

- Existing internal identifiers such as the Vercel project name, cookies, storage buckets, worker headers, and DB step keys intentionally keep qkiki-compatible names to avoid breaking active sessions, auth, storage, and queued work.
