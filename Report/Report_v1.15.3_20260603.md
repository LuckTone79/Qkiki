# Work Report

## Basic Info
- **Version**: v1.15.3-20260603
- **Date**: 2026-06-03
- **Previous Version**: v1.15.2-20260603
- **Project**: Multi AI / Qkiki

## Summary
Investigated a production V2 sequential workflow that stopped mid-chain on a PC run. The latest active run had 9 planned steps, steps 1-4 completed, and steps 5-9 still queued with no running or retrying step. This is a queue handoff stall, not a provider call currently in progress.

## Production Evidence
- Stalled execution run: `cmpxpug9d0009l1040veh0583`
- Session: `cmpxpuff30001l104w9ry9wii`
- State at investigation: run `running`, planned `9`, completed `4`, queued `5`, running `0`, retrying `0`
- First stalled step: order `5`, template step `5`, iteration `1`, model `anthropic / claude-opus-4-7`, status `queued`, attempts `0/3`
- Vercel logs showed repeated user status/stream polling for the run but no worker execution log for step 5.
- Manual QStash publish test for step 5 returned HTTP `429` with `Exceeded daily rate limit`, `limit=1000`, `remaining=0`.

## Root Cause
- Middle-step handoff can fail after a step is already marked completed.
- If QStash retries the previous step endpoint, `claimExecutionRunStep` correctly refuses to re-run the completed step.
- The old code returned after that failed claim and did not look for the next queued step.
- The watchdog only repaired stale `running` steps. It did not repair active runs with no running step and an old queued next step.
- The watchdog self-scheduled every 60 seconds even when no work needed cleanup. On a daily-limited QStash plan, this can consume the free quota before step queue messages need to run.
- When QStash daily quota is exhausted, middle-step handoff cannot publish the next worker message. The old code left the step `queued` without a visible retry/error marker.
- Result: completed step stayed immutable, but the next queued step had no new delivery message and the run stayed `running` forever.

## Changes
- Added V2 queued handoff rescue logic.
- Added rescue when a duplicate/retried message targets an already terminal step.
- Extended watchdog to scan active V2 runs that have queued/retrying steps but no running step, then enqueue the first executable step.
- Added status API rescue so opening or polling a run can wake a stalled queued step.
- Added stream API rescue so an open workbench session can wake a stalled queued step during reconnect/polling.
- Marked rescue attempts with `heartbeatAt` to prevent repeated enqueue floods while keeping claim idempotency intact.
- Changed watchdog scheduling to only self-schedule while active V2 runs exist.
- Changed the default watchdog interval from 60 seconds to 180 seconds via `WORKBENCH_WATCHDOG_INTERVAL_SECONDS`, reducing QStash daily quota pressure.
- Added QStash daily-rate-limit detection and reset-time parsing.
- When queue publish fails, the target step is moved to `retrying` with `QUEUE_RATE_LIMIT` or `QUEUE_PUBLISH_FAILED` instead of silently remaining queued.

## Changed Files
| Path | Change |
| --- | --- |
| `src/lib/execution-run-steps.ts` | Added queued handoff rescue and watchdog queued orphan recovery. |
| `src/lib/qstash.ts` | Added watchdog interval control and QStash rate-limit helpers. |
| `src/app/api/internal/workbench/watchdog/route.ts` | Reschedule watchdog only while active V2 runs exist. |
| `src/app/api/workbench/run/route.ts` | Use quota-safe watchdog interval. |
| `src/app/api/workbench/runs/[runId]/steps/[orderIndex]/branch-rerun/route.ts` | Use quota-safe watchdog interval. |
| `src/app/api/results/[id]/rerun/route.ts` | Use quota-safe watchdog interval. |
| `src/app/api/workbench/runs/[runId]/route.ts` | Wake stalled V2 queued handoff during status polling. |
| `src/app/api/workbench/runs/[runId]/stream/route.ts` | Wake stalled V2 queued handoff during stream polling. |
| `VERSION` | Updated app version. |
| `src/lib/version.ts` | Updated displayed app version. |

## Verification
- `npx tsc -p tsconfig.json --noEmit` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `git diff --check` passed.
- `npx prisma validate` passed after loading production environment values into the current process because the local `.env` does not contain `DIRECT_URL`.

## Remaining Risk
- If QStash itself is unavailable for a long period, queued handoff rescue will mark attempts but cannot deliver work until QStash accepts messages.
- Duplicate enqueue is acceptable because step claim is idempotent and terminal steps cannot be re-run.

## Version History
| Version | Date | Summary |
| --- | --- | --- |
| v1.15.3 | 2026-06-03 | Added V2 queued handoff rescue for stalled sequential runs. |
| v1.15.2 | 2026-06-03 | Stabilized V2 stream parsing, timeout retries, and source labels. |
