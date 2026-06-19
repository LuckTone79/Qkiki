# Report v1.32.5-20260619

## Summary

- Continued the backend optimization proposal after the first instrumentation slice.
- Completed the missing Phase 0/1 smoke-test and dynamic-link intent-prefetch work.
- Implemented Phase 2 list-route RSC initial data and request-level auth dedupe.
- Added the missing Playwright test runner dependency required by the new e2e smoke test.

## Changes

- Added `playwright.config.ts` and `tests/e2e/workbench-smoke.spec.ts`.
- Added `src/lib/navigation-prefetch.ts` with focused unit coverage.
- Added `src/lib/initial-list-data.ts` with focused unit coverage.
- Added `src/server/app-data/*` list loaders and serializers.
- Reused list loaders from `/api/sessions`, `/api/projects`, and `/api/presets`.
- Converted `/app/sessions`, `/app/projects`, and `/app/presets` pages to server-loaded initial data.
- Updated list clients to skip mount fetch when initial data is loaded.
- Added `/app/loading.tsx`.
- Bumped visible app version to `v1.32.5-20260619`.

## Verification

- `node --test src\lib\navigation-prefetch.test.mjs src\server\app-data\serializers.test.mjs src\lib\initial-list-data.test.mjs src\server\perf\server-timing.test.mjs src\lib\auth-handoff.test.mjs` passed.
- `npm run lint` passed.
- `npm run build` passed and generated 57 static pages.
- `npx playwright test --list` found 1 smoke test.
- `npx playwright test` passed with 1 skipped test because this worktree has no `DATABASE_URL`; the smoke test is guarded so it runs in DB-backed environments.

## Known Notes

- `npm install -D @playwright/test` saved `@playwright/test@^1.61.0` and retained the existing npm audit state: 24 vulnerabilities reported before and after this change.
- Build and Playwright web server both report the expected `.worktrees` multi-lockfile warning.
- Phase 3 is still required to remove schema checks and stale-run cleanup from execution hot paths.
