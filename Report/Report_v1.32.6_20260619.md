# Report v1.32.6-20260619

## Summary

- Completed Phase 3 of the backend optimization plan.
- Removed default runtime schema repair and stale V1 run cleanup from workbench run/status/stream hot paths.
- Moved schema guarantees to production migration plus assertion, with emergency runtime repair still available by flag.
- Moved broad V1 stale-run cleanup into the internal workbench watchdog maintenance path.

## Changes

- Added `src/lib/workbench-maintenance-policy.ts` and focused unit coverage for default-off maintenance flags.
- Added `scripts/assert-workbench-run-schema.mjs` and wired it after `prisma migrate deploy` in production prebuild.
- Updated workbench run schema/session schema helpers to return migration-backed capabilities by default and only inspect/repair DB schema when `LEGACY_WORKBENCH_SCHEMA_REPAIR=1`.
- Removed default `schema` and `stale_runs` timing work from `POST /api/workbench/run`, `GET /api/workbench/runs/[runId]`, and `GET /api/workbench/runs/[runId]/stream`.
- Extended `/api/internal/workbench/watchdog` to run broad stale V1 run cleanup outside the user request path.
- Added `docs/perf/PHASE_3_HOT_PATH_2026-06-19.md`.
- Bumped visible app version to `v1.32.6-20260619`.

## Verification

- `node --test src\lib\workbench-maintenance-policy.test.mjs src\server\perf\server-timing.test.mjs src\lib\initial-list-data.test.mjs src\server\app-data\serializers.test.mjs` passed with 13 tests.
- `node scripts\assert-workbench-run-schema.mjs --dry-run` passed and printed the required schema manifest.
- `node scripts\assert-workbench-run-schema.mjs` skipped locally because this worktree has no `DATABASE_URL`; production prebuild still requires DB env.
- Hot-path review confirmed `schema` and `stale_runs` timing segments are only reachable behind legacy fallback flags in workbench run/status/stream routes.
- `npx tsc -p tsconfig.json --noEmit` passed.
- `npm run lint` passed.
- `npm run build` passed and generated 57 static pages.
- `git diff --check` passed.
- `npx playwright test` passed with 1 skipped smoke test because this worktree has no `DATABASE_URL`.

## Known Notes

- Local schema assertion without `DATABASE_URL` is skipped outside production; production prebuild still requires `DATABASE_URL` and `DIRECT_URL`.
- `LEGACY_WORKBENCH_REQUEST_STALE_CLEANUP=1` exists only as an incident fallback and is disabled by default.
