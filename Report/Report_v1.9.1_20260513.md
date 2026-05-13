# Qkiki v1.9.1 (2026-05-13)

## Summary
- Removed the application-level AI provider timeout so the app no longer aborts long-running provider requests on its own.
- Removed the admin-facing timeout control from provider settings to match runtime behavior and reduce configuration confusion.
- Set long-running AI routes to Vercel's 300-second function duration ceiling for this deployment shape.

## What Changed
### 1. Internal AI timeout removal
- `src/lib/ai/providers.ts`
  - Removed `AbortSignal.timeout(...)` from provider execution.
  - Provider calls now run without an app-enforced request deadline.
  - Timeout-like errors are still surfaced if they come from the upstream provider or platform, but they are no longer caused by this app's own timeout setting.

### 2. Admin provider settings cleanup
- `src/components/admin/AdminProvidersClient.tsx`
  - Removed the timeout input from the admin UI.
- `src/app/api/admin/providers/route.ts`
  - Stopped reading/writing timeout values from the admin settings payload.
- `src/lib/validation.ts`
  - Removed timeout validation from the admin provider config schema.

### 3. Route duration safeguards
- Added `export const maxDuration = 300` to:
  - `src/app/api/workbench/run/route.ts`
  - `src/app/api/workbench/branch/route.ts`
  - `src/app/api/workbench/compare/route.ts`
  - `src/app/api/results/[id]/rerun/route.ts`

## Important Constraint
- The app-level timeout is now removed.
- However, Vercel Functions still have a platform maximum duration, so requests are not truly infinite on the deployed environment.
- On this project shape, the long-running AI routes are now explicitly configured to use `300` seconds, which is the practical upper bound currently applied here.

## Verification
- `npx eslint` on changed files: passed
- `npm run build`: passed
