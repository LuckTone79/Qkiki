# Phase 2 RSC Lists - 2026-06-19

## Scope

- Wrapped `getCurrentUser()` with React request-level `cache()`.
- Added server list-data functions for sessions, projects, and presets.
- Converted `/app/sessions`, `/app/projects`, and `/app/presets` to async Server Components.
- Passed API-shaped initial data into existing client components.
- Kept existing list APIs for client-side refresh and mutation flows.

## Contract

- Server loaders serialize `Date` values to ISO strings so client component props match existing API JSON shape.
- Clients skip mount-time list fetch only when `initialLoaded` is explicitly true.
- Mutation flows still call the same API refresh paths after create, duplicate, rename, or delete operations.

## Verification Targets

- `src/server/app-data/serializers.test.mjs` covers API-shaped serialization.
- `src/lib/initial-list-data.test.mjs` covers the mount-fetch skip decision.
- `npm run build` validates App Router server/client boundaries.
- `tests/e2e/workbench-smoke.spec.ts` validates authenticated list route navigation.

## Notes

- This phase removes the initial client fetch waterfall for list routes, but does not remove the APIs.
- Runtime schema work remains in the session list loader until Phase 3 moves schema assertions to build/migration.
- Local Playwright execution is skipped without `DATABASE_URL`; DB-backed environments execute the smoke test.
