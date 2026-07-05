# Qkiki Structure Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove verified structural bottlenecks from Qkiki's workbench execution path and deploy the behavior-preserving release.

**Architecture:** Keep Next.js Route Handler contracts and runner semantics stable. Move schema guarantees to production migration/assertion, reduce repeated database work with tested server helpers, and extract only the stream lifecycle from the large client island.

**Tech Stack:** Next.js 16.2.3, React 19.2.4, TypeScript, Prisma 6.19/PostgreSQL, Node test runner, Playwright, Vercel.

---

### Task 1: Add performance and schema safety

**Files:**
- Create: `src/server/perf/server-timing.ts`
- Create: `src/server/perf/server-timing.test.mjs`
- Create: `src/server/workbench/schema-compat.ts`
- Create: `src/server/workbench/schema-compat.test.mjs`
- Create: `scripts/assert-workbench-run-schema.mjs`
- Modify: `scripts/prebuild-migrate.mjs`
- Modify: the workbench run, status, stream, and usage Route Handlers

- [ ] Write tests that expect disabled-by-default repair gating and valid `Server-Timing` formatting.
- [ ] Run focused tests and confirm failures because the helpers do not exist.
- [ ] Implement the minimal helpers and rerun the tests.
- [ ] Add the schema assertion after `prisma migrate deploy` and remove unconditional hot-path repair calls.
- [ ] Verify source scans show no unconditional route-level DDL repair.

### Task 2: Consolidate usage reads

**Files:**
- Modify: `src/lib/usage-policy.ts`
- Create or modify: focused usage snapshot tests

- [ ] Add a failing test for deriving request and credit pending totals from one aggregate result.
- [ ] Implement one aggregate read for the access snapshot.
- [ ] Preserve the existing fresh aggregate inside the serializable reservation transaction.
- [ ] Run focused and full unit tests.

### Task 3: Reduce stream polling cost

**Files:**
- Create: `src/server/workbench/run-stream-cursor.ts`
- Create: `src/server/workbench/run-stream-cursor.test.mjs`
- Modify: `src/app/api/workbench/runs/[runId]/stream/route.ts`

- [ ] Add failing tests for cursor equality and bounded unchanged-poll backoff.
- [ ] Implement cursor comparison/backoff.
- [ ] Query the compact cursor every poll and fetch the full snapshot only on change.
- [ ] Keep rescue checks on their existing bounded cadence.
- [ ] Run stream tests and full unit tests.

### Task 4: Establish client and runner seams

**Files:**
- Create: `src/client/workbench/hooks/useRunStream.ts`
- Create: `src/server/workbench/runner-metrics.ts`
- Create: `src/server/workbench/runner-metrics.test.mjs`
- Modify: `src/components/workbench/WorkbenchClient.tsx`
- Modify: runner kickoff/completion points only as required by metrics

- [ ] Add a failing pure test for runner metric labels/fields.
- [ ] Implement metrics without changing runner selection.
- [ ] Move the existing stream reader lifecycle into a callback-driven hook.
- [ ] Confirm the JSX and user-visible behavior remain unchanged.

### Task 5: Release hygiene and versioning

**Files:**
- Modify: `.gitignore`
- Modify: `VERSION`
- Modify: `package.json` and `package-lock.json`
- Modify: `src/lib/version.ts`
- Modify: `CHANGELOG.md`
- Create: `Report/Report_v1.36.0_20260706.md`

- [ ] Ignore generated Codex logs/screenshots without deleting user artifacts.
- [ ] Set every version surface to `v1.36.0-20260706` (npm semver `1.36.0`).
- [ ] Record implemented and deferred work in Korean.
- [ ] Confirm the existing UI imports `APP_VERSION` in user-visible locations.

### Task 6: Verify, commit, and deploy

- [ ] Run focused tests, `npm test`, `npx tsc -p tsconfig.json --noEmit`, `npm run lint`, `npm run build`, and `git diff --check`.
- [ ] Run the schema assertion with the production-linked environment.
- [ ] Review the complete diff against the design requirements.
- [ ] Commit intentional changes and push `codex/structure-improvements-20260706`.
- [ ] Deploy with `vercel --prod --yes`, inspect Ready status, and verify Yapp/qkiki HTTP aliases plus visible version.
