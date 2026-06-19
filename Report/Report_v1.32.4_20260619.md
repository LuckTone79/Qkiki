# Report v1.32.4-20260619

## Summary

- Executed Phase 0 and Phase 1 of the backend optimization proposal.
- Added opt-in server timing instrumentation to selected hot API routes.
- Added opt-in web vitals logging for the authenticated app shell.
- Added loading boundaries and reusable skeleton UI for main app routes.
- Restored default Next.js prefetching for stable sidebar/mobile navigation links while keeping high-cardinality dynamic links guarded.

## Changed Areas

- `src/server/perf/*`
- `src/app/api/usage/route.ts`
- `src/app/api/sessions/route.ts`
- `src/app/api/projects/route.ts`
- `src/app/api/presets/route.ts`
- `src/app/api/workbench/run/route.ts`
- `src/app/api/workbench/runs/[runId]/route.ts`
- `src/app/api/workbench/runs/[runId]/stream/route.ts`
- `src/app/app/*/loading.tsx`
- `src/app/app/WebVitalsReporter.tsx`
- `src/components/AppShell.tsx`
- `src/components/AppRouteLoading.tsx`
- `docs/perf/BASELINE_2026-06-19.md`

## Verification

- `node --test src\server\perf\server-timing.test.mjs` passed.
- `npm run lint` passed.
- `npm run build` passed.
- Build warning: Next.js reports multiple lockfiles because the implementation worktree is nested under `.worktrees`; no build failure occurred.

## Follow-Up

- Capture real `PERF_TRACE=1` timings from production-like authenticated flows.
- Use the captured baseline to choose the next database/index/query optimization target.
- Revisit dynamic link prefetching only after measuring sidebar fetch cost.
