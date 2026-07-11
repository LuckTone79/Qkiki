# Work Report

## Basic Info
- **Version**: v1.15.2-20260603
- **Date**: 2026-06-03
- **Previous Version**: v1.15.1-20260603
- **Project**: Multi AI / Qkiki

## Summary
Investigated the shared sequential workflow run that showed `JSON Parse error: Unexpected EOF` during an 11-step repeated review chain and later finished as 10 succeeded / 1 failed. The production DB showed the run continued through QStash-backed V2 execution; the visible EOF was a client stream parsing failure caused by a long-lived NDJSON stream being cut mid-event.

Also verified that repeated V2 steps were using `sourceMode=previous` with saved source snapshots from the nearest prior completed result. The confusing `Source: original input` text was a display/query issue for V2 results, not the actual execution source.

## Root Cause
- The V2 run stream endpoint could stay open until terminal completion. Long Opus/repeated runs can exceed serverless/proxy stream lifetime, causing the browser to receive a truncated JSON line and surface `Unexpected EOF`.
- The client parsed partial stream buffers with direct `JSON.parse`, so a network/serverless truncation became a user-facing fatal parse error instead of falling back to DB status refresh and reconnect.
- Provider timeout retries had an off-by-one condition after step claim increments `attemptCount`, so a `maxAttempts=3` timeout policy could stop after two actual provider calls.
- Timeout retry policy defined `timeoutMultiplier` and `maxTimeoutMs`, but the provider call path did not pass an increased retry timeout.
- V2 `ExecutionRunStep.sourceMode` was not selected into result cards/shared payloads, so V2 results without `parentResultId` defaulted to `Source: original input` even when execution used previous completed output.

## Changes
- Added a bounded V2 stream lifetime so the server closes long run streams cleanly and the client continues via status refresh/reconnect.
- Made stream event parsing tolerate truncated EOF/unterminated final chunks without surfacing a false workflow error.
- Added provider timeout override support and applied timeout multiplier/cap for retry attempts.
- Fixed timeout retry attempt counting so `maxAttempts=3` means up to three actual claimed provider attempts.
- Exposed `ExecutionRunStep.sourceMode` and `sourceResultId` through result selects and shared payload types.
- Updated result cards to label V2 sources as original input, previous completed result, selected result, or prior completed results according to `ExecutionRunStep.sourceMode`.

## Production Evidence
- Shared token investigated: [REDACTED; sha256=60e34c06400f3f93364c9086aa2f3a116c222a112eae9312d2f9cbccecc25b5a].
- Execution run: `cmpxk56ny001kjp04dxu6aujf`, runner `v2`, status `partial`, planned steps `11`.
- Failed step: order `8`, template step `2`, iteration `4`, model `anthropic / Opus 4.7`, error `PROVIDER_TIMEOUT`, message `anthropic: provider request timed out after 180 seconds.`
- Step 8 source snapshot came from step 7 completed output.
- Step 9 also used the nearest previous completed output because step 8 failed; failed error text was not used as source.

## Changed Files
| Path | Change |
| --- | --- |
| `src/app/api/workbench/runs/[runId]/stream/route.ts` | Bound V2 stream duration for clean reconnects. |
| `src/components/workbench/WorkbenchClient.tsx` | Tolerate truncated EOF stream chunks. |
| `src/components/workbench/ResultCard.tsx` | Display V2 execution source labels from `ExecutionRunStep.sourceMode`. |
| `src/lib/workbench-result-read.ts` | Select execution step source fields for result cards. |
| `src/lib/shared-links.ts` | Include execution step source fields in shared result payload type. |
| `src/lib/ai/providers.ts` | Support provider timeout override per call. |
| `src/lib/ai/types.ts` | Add provider timeout override input field. |
| `src/lib/execution-run-steps.ts` | Apply timeout retry multiplier and fix retry attempt condition. |
| `VERSION` | Updated app version. |
| `src/lib/version.ts` | Updated displayed app version. |

## Verification
- `npx tsc -p tsconfig.json --noEmit` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `git diff --check` passed.
- `npx prisma validate` passed after loading production environment values into the current process because the local `.env` does not contain `DIRECT_URL`.
- No project-local `*.test.*` files were found outside `node_modules`.

## Remaining Risk
- A provider can still legitimately timeout after all retry attempts; the fix prevents false stream parse errors and improves retry policy, but it does not guarantee Opus calls always complete.
- Step 9 fallback to the nearest previous completed result is intentional recovery behavior. If product behavior should instead skip downstream steps after a failed critique step, that requires a workflow policy change rather than a bug fix.

## Version History
| Version | Date | Summary |
| --- | --- | --- |
| v1.15.2 | 2026-06-03 | Stabilized V2 stream parsing, provider timeout retries, and repeated source labels. |
| v1.15.1 | 2026-06-03 | Improved public sharing link clipboard handling. |
