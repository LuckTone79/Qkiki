# Qkiki v1.9.0 (2026-05-13)

## Summary
- Stabilized production/serverless database access by identifying the live root cause as Supabase session-pool exhaustion on Vercel.
- Reduced database pressure in the usage-status path and added short-lived client usage caching to cut repeated read traffic.
- Fixed provider execution reliability for sequential chains by correcting Anthropic request formatting, lowering effective timeout defaults, enabling configured fallback providers, and steering new workflow defaults toward faster models.

## Root Cause Findings
### 1. Server instability / intermittent login or page failures
- Vercel production logs showed `FATAL: MaxClientsInSessionMode: max clients reached - in Session mode max clients are limited to pool_size`.
- The production database URL was pointing to the Supabase pooler on port `5432`, which is session mode and a poor fit for bursty serverless workloads.
- `/api/usage` was especially expensive for a frequently called request because it performed redundant subscription/profile queries plus usage-record lookups/updates.

### 2. AI latency and provider failures
- Recent production `AiRequest` data showed `openai/gpt-5.5` averaging about 56 seconds per request and `google/gemini-3.1-pro-preview` about 51 seconds.
- `anthropic/claude-opus-4-7` was not merely slow; it was failing immediately because the request body still sent a deprecated `temperature` field for that model.
- Timeout handling was structurally misleading: admin configs stored `60` seconds, but code upgraded legacy values like `60` to `300`, causing five-minute waits in practice.
- The sequential chain passed full prior outputs into later steps with no truncation, which allowed prompt size to grow unnecessarily and hurt latency.

## Code Changes
### Database and stability
- Simplified `src/lib/usage-policy.ts` to avoid redundant subscription reads and switched usage-record lookup/create to `upsert`.
- Added short-lived client-side usage caching in `src/lib/local-cache.ts` and applied it in:
  - `src/components/workbench/WorkbenchClient.tsx`
  - `src/components/account/AccountClient.tsx`
- Expanded database URL detection in `src/lib/auth-config.ts` so auth/runtime diagnostics also recognize `prisma://` and `prisma+postgres://` style URLs.
- Added unexpected API error logging in `src/lib/api-auth.ts`.

### AI provider runtime
- Updated provider defaults in `src/lib/ai/provider-catalog.ts` toward faster operational defaults:
  - OpenAI default model -> `gpt-5.4-mini`
  - Google default model -> `gemini-2.5-flash`
  - Lower default timeout ceilings per provider
- Removed the legacy timeout upgrade behavior that silently turned `60/90/180` into `300`.
- Fixed Anthropic requests in `src/lib/ai/providers.ts` by removing the deprecated `temperature` field.
- Changed OpenAI Responses requests to prefer synchronous completion (`background: false`, `store: false`) and faster polling cadence when polling is still needed.
- Implemented real fallback-provider execution using the already-existing admin config field and added structured fallback logging.
- Exported runtime default-model resolution so server-side summaries use the effective provider default instead of a stale hardcoded catalog value.

### Workflow responsiveness
- Added truncation guards in `src/lib/ai/workflow.ts` for:
  - Project context
  - Previous-step source text
  - Combined multi-result source text
- Ensured persisted result rows and `AiRequest` rows store the actual provider/model used after fallback.
- Updated new workbench sequential defaults in `src/components/workbench/WorkbenchClient.tsx` to faster baseline models.

## Verification
- `npx eslint` on all changed files: passed
- `npx tsc --noEmit`: passed after generating `.next/types`
- `npm run build`: passed

## Required production follow-up applied outside code
- Update Vercel `POSTGRES_PRISMA_URL` from Supabase session-pool port `5432` to transaction-pool port `6543` with serverless-safe query params.
- Update production provider admin config defaults/timeouts/fallbacks in the database so the live UI/runtime behavior matches the new code defaults immediately.
