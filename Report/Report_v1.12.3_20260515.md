# Report v1.12.3-20260515

## Summary
- Fixed the sequential review chain display so repeated steps are planned and shown as expanded execution units.
- Added running result cards as soon as each provider call starts, so a blocked provider call is visible in the result board.
- Added a server watchdog to close stale workbench runs and running result rows automatically.

## Changes
- Sequential progress now expands repeat blocks for the monitor before execution starts.
- Workflow streaming now emits a `running` result immediately after the DB result row is created.
- Result cards now render a clear running state and hide follow-up actions until the output arrives.
- Stale `queued`/`running` execution runs are closed during run start, status polling, and stream connection.
- Stale running result rows are marked failed, and usage reservations are released or settled based on completed work.

## Verification
- `npm run lint` passed with one existing generated workflow route warning.
- `npm run build` passed with Next.js 16.2.3 and TypeScript checks.
