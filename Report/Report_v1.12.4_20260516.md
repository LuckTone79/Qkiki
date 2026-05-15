# Report v1.12.4-20260516

## Summary
- Fixed sequential review chain execution so explicit workflow-builder model selections are not silently replaced by fallback providers.
- Reworked progress cards to show visible task/input/output snippets instead of fabricated system-like computation messages.
- Separated "latest completed step" from the true final result badge in sequential runs.
- Relaxed the stale-run watchdog from 180 seconds to 1800 seconds so long sequential chains can finish while still preventing indefinitely stuck runs.

## Changes
- Added an `allowFallback` provider-call option and disabled fallback for persisted workbench step execution.
- Kept fallback behavior available for comparison summary generation where an alternate summarizer is acceptable.
- Updated sequential result ordering to remain chronological and only mark an explicit completed final result as final.
- Added a "진행 step중 최신결과" badge for the newest completed non-final step.
- Renamed the progress detail label to "실시간 입력/출력" and removed rotating pseudo-thinking status text.
- Increased `WORKBENCH_STALE_RUN_SECONDS` default safety timeout to 30 minutes, with a minimum override of 5 minutes.

## Verification
- `npm run lint` passed with one existing generated workflow route warning.
- `npm run build` passed with Next.js 16.2.3 and TypeScript checks.
