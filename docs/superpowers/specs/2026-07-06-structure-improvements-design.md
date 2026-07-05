# Qkiki Structure Improvements Design

**Date:** 2026-07-06  
**Status:** Approved for implementation by the user's request to continue, improve, commit, and deploy

## Goal

Reduce workbench request latency and maintenance risk without changing the product's visible workflows, API contracts, credit correctness, or parallel/sequential semantics.

## Evidence-based scope

The external review is directionally correct, with two corrections:

1. `ensureWorkbenchRunSchema()` is process-cached, so it does not execute every probe on every warm request. It still performs schema discovery and can execute DDL on cold instances, which does not belong in user request paths.
2. V2 currently covers sequential execution only. It cannot replace the parallel runner until explicit parity exists, so this release must not force a global V2 cutover.

This release implements the safe, provider-independent improvements:

- add opt-in performance timing and regression safety;
- assert required workbench schema after production migrations;
- remove schema repair and broad stale-run cleanup from normal run/status/stream paths, retaining an emergency flag;
- consolidate duplicated usage reservation aggregates while preserving fresh serializable checks;
- reduce stream polling cost by separating a lightweight change cursor from full snapshots and by backing off when unchanged;
- extract the stream client lifecycle from `WorkbenchClient` without redesigning the UI;
- strengthen runner observability without changing production cohort selection;
- introduce focused server/client boundaries only where changed code naturally belongs;
- align repository ignores and all version surfaces.

Payment gateway integration and attachment object-storage migration are separate projects. Both require a provider, credentials, operational policies, migration/backfill plans, and independent rollback procedures. This release documents them as follow-ups rather than shipping an unverifiable provider choice.

## Architecture

Hot Route Handlers remain dynamic and authenticated. They call small server-only services for schema compatibility, usage snapshots, stream cursors, and metrics. Runtime schema repair is disabled by default and is available only through `LEGACY_WORKBENCH_SCHEMA_REPAIR=1` during an emergency rollout.

The SSE endpoint first reads a compact cursor containing status and maximum update timestamps. It fetches and emits the full result snapshot only when that cursor changes. Polling begins at one second for active progress and backs off within a short bounded interval when no data changes. Headers are finalized before the stream starts, consistent with the local Next.js 16 streaming guide.

The browser-side stream reader becomes a focused hook/service with callbacks. `WorkbenchClient` retains product state and JSX during this release, minimizing regression risk while establishing the seam for later panel extraction.

## Correctness and failure handling

- Production builds fail if migrations complete but required columns, tables, or indexes are absent.
- The emergency repair flag is explicit and logged; normal requests never issue DDL.
- Credit reservation decisions continue to re-read pending reservations inside the existing serializable transaction.
- Stream cursor failures use the existing stream error path and do not silently mark runs complete.
- Runner selection defaults and cohort environment variables remain unchanged.

## Verification

- Test-first unit tests cover timing serialization, schema-repair gating, polling backoff/cursor comparison, and runner metrics.
- Existing 190-test baseline remains green.
- TypeScript, ESLint, production build, schema assertion, and workbench smoke checks run before commit/deploy.
- The deployed version is verified on `https://yapp.wideget.net` and the Vercel deployment is inspected as Ready.

## Deferred projects

- Payment provider selection and webhook-backed paid-credit grants.
- Object-storage provider selection, dual-write rollout, backfill, retention, and deletion policy.
- Parallel runner V2 implementation and cohort rollout based on production metrics.
- Remaining panel-by-panel `WorkbenchClient` extraction after bundle/INP measurements.
