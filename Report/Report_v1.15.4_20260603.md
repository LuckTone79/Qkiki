# Work Report

## Basic Info
- **Version**: v1.15.4-20260603
- **Date**: 2026-06-03
- **Previous Version**: v1.15.3-20260603
- **Project**: Multi AI / Qkiki

## Summary
Retested the stalled V2 sequential run after the user upgraded QStash. The QStash daily quota issue was resolved, but delivery still failed because the production `APP_BASE_URL` environment variable contained a literal `\\r\\n` suffix. QStash therefore delivered to `/r/n/api/internal/...` and received HTTP 404.

## Production Evidence
- Production env line: `APP_BASE_URL=\"https://qkiki.vercel.app\\r\\n\"`
- QStash delivery URL for stalled step 5:
  `https://qkiki.vercel.app/r/n/api/internal/workbench/run-steps/cmpxpugcs000el104gifou2b7/execute`
- QStash log state: `ERROR`, HTTP `404`, then `RETRY`
- Run affected: `cmpxpug9d0009l1040veh0583`

## Root Cause
- `getAppBaseUrl()` only trimmed whitespace and trailing `/`.
- The production env contained literal backslash characters, not actual newlines.
- Those characters were preserved in the published QStash target URL and became `/r/n/...` on delivery.

## Changes
- Added base URL normalization in `src/lib/qstash.ts` to strip both actual CR/LF characters and literal `\\r` / `\\n` sequences before publishing worker/watchdog URLs.
- Tightened sequential runner readiness to validate the normalized URL path.

## Changed Files
| Path | Change |
| --- | --- |
| `src/lib/qstash.ts` | Normalize malformed base URLs before QStash publish. |
| `VERSION` | Updated app version. |
| `src/lib/version.ts` | Updated displayed app version. |

## Verification
- `npx tsc -p tsconfig.json --noEmit` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `git diff --check` passed.
- `npx prisma validate` passed after loading production environment values into the current process because the local `.env` does not contain `DIRECT_URL`.

## Remaining Risk
- Existing queued QStash messages created before the env fix still target the broken URL and will keep 404ing until they exhaust retries.
- The production `APP_BASE_URL` variable should still be corrected at the source to prevent future operational confusion, even though the runtime normalization now masks this specific malformed value.

## Version History
| Version | Date | Summary |
| --- | --- | --- |
| v1.15.4 | 2026-06-03 | Hardened QStash base URL normalization and resumed post-upgrade queue testing. |
| v1.15.3 | 2026-06-03 | Added queued handoff rescue and reduced QStash quota pressure. |
