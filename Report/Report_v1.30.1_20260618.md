# Work Report

## Basic Info
- Version: `v1.30.1-20260618`
- Date: `2026-06-18`
- Previous Version: `v1.30.0-20260618`
- Project: `Yapp`

## Summary
This release improves workbench run recovery so an active server-side execution
is resumed before any unsaved local draft when the user reopens the workbench
without a `?session=` query. The workbench now rewrites the URL to the active
session, reconnects to the existing run, and keeps legacy local-storage keys
readable while newer Yapp keys are used for future writes.

## Main Changes
- Added `src/lib/workbench-resume.ts` to centralize active-run detection,
  session-query rewriting, and initial-entry decision rules.
- Added `src/lib/workbench-resume.test.mjs` to lock the priority order:
  explicit session, force-new, project, active server run, local draft, default.
- Updated `src/components/workbench/WorkbenchClient.tsx` so a fresh
  `/app/workbench` entry checks `/api/sessions`, rewrites to the newest active
  session, and only falls back to local draft/default state when no active run exists.
- Preserved result-layout and other browser preferences across the Yapp rename by
  reading legacy Qkiki keys and writing back to the new Yapp keys.
- Applied Claude Sonnet 4.6 review feedback by checking `response.ok` before
  parsing the session-list body in the active-run auto-resume path.

## Verification
- `node --test src/lib/workbench-resume.test.mjs`
- `npx tsc -p tsconfig.json --noEmit`
- `npx eslint src/components/workbench/WorkbenchClient.tsx src/lib/workbench-resume.ts`
- `npm run build`
- `curl.exe -I http://127.0.0.1:3000/app/workbench`
- Claude Sonnet 4.6 API review on the workbench-resume patch, with the accepted
  fix applied and re-verified.

## Follow-up
- Full authenticated browser proof of live run reconnection still depends on a
  signed-in local session; the unauthenticated local route correctly redirects
  to `/sign-in`.
- The worktree still contains unrelated pre-existing edits outside this fix, so
  commit and deployment should stage only the verified release subset.
