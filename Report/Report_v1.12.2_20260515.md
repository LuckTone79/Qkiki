# Report v1.12.2-20260515

## Summary
- Improved admin navigation feedback with active/pending states and route-level loading skeletons.
- Added a full-run stop path for workbench durable runs, including UI controls, API cancellation, workflow cancellation, and execution-run state updates.
- Hardened sequential review chains so failed steps stop the chain cleanly as a partial run instead of continuing to consume calls or leaving the UI stuck.

## Details
- Added `DELETE /api/workbench/runs/[runId]` to mark active runs canceled, release unused reservations, and request cancellation from the workflow runtime.
- Added cancellation-aware execution-run helpers so canceled runs are not overwritten back to `running`, `failed`, or `completed` by late workflow callbacks.
- Added sequential-chain cancellation checks before and after each step, and stopped subsequent steps after a provider failure to prevent cascading token usage.
- Improved workflow catch handling to close usage reservations even when a canceled workflow exits through an exception after partial progress.
- Added visible "Stop all" controls while a workbench run is active.

## Verification
- `npm run lint` passed with one existing generated workflow route warning.
- `npm run build` passed with Next.js 16.2.3 and TypeScript checks.
