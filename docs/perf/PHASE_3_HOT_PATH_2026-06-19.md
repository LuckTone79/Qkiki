# Phase 3 Hot Path Maintenance - 2026-06-19

## Scope

- Removed default runtime schema repair from workbench run, status, and stream request paths.
- Added `scripts/assert-workbench-run-schema.mjs` so production build fails after migration if required workbench run columns, tables, or indexes are missing.
- Kept the old runtime repair path behind `LEGACY_WORKBENCH_SCHEMA_REPAIR=1`.
- Removed default stale V1 run cleanup from user request paths.
- Moved broad stale V1 run cleanup into the internal workbench watchdog path.

## Runtime Contract

- Production deploy runs `prisma migrate deploy`, then asserts the required workbench schema before serving traffic.
- With default env, schema helpers return the migration-backed capability contract without querying `information_schema` or running DDL.
- `LEGACY_WORKBENCH_REQUEST_STALE_CLEANUP=1` can temporarily restore request-path stale cleanup while investigating production incidents.
- V1 run creation queues the internal watchdog on a best-effort basis so stale cleanup runs through the maintenance path instead of blocking user requests.

## Verification Targets

- `src/lib/workbench-maintenance-policy.test.mjs` covers the default-off maintenance flags.
- `node scripts/assert-workbench-run-schema.mjs --dry-run` validates the assertion manifest without requiring a local database.
- `npm run build` validates App Router route-handler boundaries and production prebuild behavior outside Vercel.

## Notes

- Direct `Server-Timing` schema and stale-run segments are no longer emitted on default run/status/stream requests.
- Local DB-backed schema assertion is skipped without `DATABASE_URL`; production still requires `DATABASE_URL` and `DIRECT_URL`.
