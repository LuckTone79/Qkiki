@AGENTS.md

# CLAUDE.md — Qkiki Workbench

> Mandatory project rules live in `AGENTS.md` (imported above). Read it first.
> This file gives AI assistants a fast, accurate map of the codebase so changes
> stay consistent with current conventions. Keep it in sync when structure,
> workflows, or conventions change.

## What This Project Is

**Qkiki** (package name `qkiki-workbench`, historically "Multi AI") is a
SaaS-style **Multi-AI Orchestration Workbench**. It is **not a chatbot UI**. The
central object is a **result card** that can become the source for follow-up
branches, critique, improvement, summarization, reruns, and final selection.

Core flow:

1. A user enters one task.
2. Selected models run **in parallel** (Parallel Compare) or through a
   **sequential workflow route** (Review Chain).
3. Each provider output becomes a persisted `Result` card.
4. Any result can spawn follow-up branches, be reviewed/critiqued/improved by
   another model, be rerun, or be marked final.
5. Related sessions group into a `Project` folder with shared context.
6. Workflow routes save as reusable `Preset`s.

Production runs on Vercel at `qkiki.wideget.net` (canonical host) with the
`qkiki.vercel.app` alias redirecting to it.

## Tech Stack

- **Next.js 16** (App Router) — `next@16.2.3`. ⚠️ This is intentionally a
  newer/breaking Next.js. Conventions differ from older versions. **Read the
  bundled docs in `node_modules/next/dist/docs/` before writing Next.js code.**
- **React 19**, **TypeScript 5** (strict), **Tailwind CSS 4**
- **Prisma 6** ORM against **PostgreSQL** (Supabase; SQLite is no longer used —
  README sections that mention SQLite are stale)
- **Upstash QStash** (`@upstash/qstash`) + the **`workflow`** package for
  asynchronous, durable workflow execution
- **Zod 4** for validation; **bcryptjs** for password hashing
- **pdf-parse** / **mammoth** for attachment text extraction
- **Playwright** (dev) for screenshot/UI verification

## Repository Layout

```
src/
  app/                     Next.js App Router (pages + route handlers)
    app/                   Authenticated product (/app/*): workbench, projects,
                           sessions, presets, pricing, account
    admin/                 Admin panel (admin.* host → /admin) with (panel) group
    api/                   Route handlers
      auth/                Email/password + Google OAuth, handoff, health
      admin/               Admin APIs (auth, users, coupons, providers, audit…)
      workbench/           Run, compare, branch, runs/[runId]/* (v2 async API)
      internal/workbench/  Worker-only endpoints (QStash-signed step execution,
                           watchdog) — guarded by INTERNAL_WORKER_SECRET
      sessions, results, projects, presets, providers, attachments,
      subscription, coupons, trial, usage, account
    guide, shared/[token], sign-in, sign-up, open-in-browser
  components/              UI by domain: workbench, admin, projects, sessions,
                           presets, billing, account, share, i18n, + shared shell
  lib/                     Server + shared logic (see below)
    ai/                    Provider catalog, prompts, normalized provider calls,
                           pricing, workflow engine, token budgeting
    fixtures/              Test fixtures (e.g. sample.docx)
  workflows/               Durable workflow definitions (workbench-run.ts)
prisma/
  schema.prisma           Postgres relational model (40+ models/enums)
  migrations/             Prisma migrations
scripts/                  prebuild-migrate, reset-password, cleanup utilities
docs/                     ARCHITECTURE.md, IMPLEMENTATION_PLAN.md, review reports
                          (treat as background; verify against code — some predate
                          the Postgres/QStash/admin/billing work)
Report/                   Per-version work reports + verification screenshots
proxy.ts                  Next.js proxy (formerly "middleware"): canonical-host
                          redirects + admin host rewrite
```

Path alias: `@/*` → `./src/*`.

## Key `src/lib` Modules

- `prisma.ts` — singleton Prisma client.
- `auth.ts` / `api-auth.ts` — user session auth. `auth.ts` is for pages
  (redirects); `api-auth.ts` returns JSON errors for API routes. **Never trust
  client-provided user IDs — derive the user from the session cookie and verify
  ownership.**
- `admin-auth.ts` / `admin-api-auth.ts` / `admin-audit.ts` — separate admin
  session + MFA + audit logging.
- `auth-config.ts`, `auth-constants.ts`, `auth-handoff.ts`, `google-oauth.ts`,
  `canonical-host.ts` — auth/session/cross-host plumbing.
- `secret-crypto.ts` — AES-256-GCM encryption for stored provider keys/content.
- `validation.ts`, `workbench-run-schema.ts`, `workbench-session-schema.ts` —
  Zod schemas for run/session payloads.
- `execution-runs.ts` / `execution-run-steps.ts` — **v2 async run engine**:
  persists `ExecutionRun`/`ExecutionRunStep`, signs payloads, drives QStash.
- `qstash.ts` — QStash client, enqueue helpers, watchdog scheduling, rate-limit
  detection. `internal-worker-auth.ts` guards worker endpoints.
- `workbench-run-watchdog.ts`, `workbench-runner-version.ts` — run recovery and
  **v1/v2 runner cohort selection** (env-driven allowlist / percent rollout).
- `provider-concurrency.ts` / `provider-lease-errors.ts` /
  `provider-availability.ts` — `ProviderLease`-based concurrency limiting.
- `subscription.ts`, `usage-policy.ts`, `usage-types.ts`, `access-policy.ts` —
  plans, trials, daily token limits, usage reservations/logs, gating.
- `attachments.ts` / `attachment-files.ts` — server-side file ingestion.
- `shared-links.ts`, `workbench-sharing.ts` — public share tokens.
- `local-cache.ts`, `version.ts`, plus many `workbench-*` UI-state helpers.

## AI Provider Layer (`src/lib/ai`)

- `provider-catalog.ts` — supported providers/models + **legacy model
  remapping**. Current families: **OpenAI** (gpt-5.5 / 5.4 / 5.4-mini /
  5.4-nano), **Anthropic** (claude-sonnet-4-6, claude-haiku-4-5,
  claude-opus-4-8), **Google** (gemini-3-flash-preview, gemini-3-pro-preview,
  gemini-2.5-*), **xAI** (grok-4.3, grok-4.20-*). Stale saved models are
  normalized to current catalog entries — update maps here when catalog changes.
- `providers.ts` — server-side adapters (OpenAI Responses API, Anthropic
  Messages, Gemini generateContent, xAI chat). Each normalizes to: provider,
  model, output text, raw response, token usage, latency, estimated cost,
  status, error. **All provider calls are server-side only; keys never reach the
  browser.**
- `prompt.ts` — composes prompts for generate / critique / fact-check / improve /
  summarize / simplify / consistency-review / follow-up, injecting input,
  instruction, output style, source result, and project shared context.
- `workflow.ts` + `workflow-control.ts` — the orchestration engine (parallel
  compare with partial-failure tolerance, sequential chains, branches, reruns).
- `pricing.ts`, `token-budget.ts`, `error-policy.ts`, `types.ts`, display helpers.

**Partial-failure rule:** if one provider fails during a parallel run, it becomes
a *failed result card* — the session and other results stay intact. Never let one
provider error crash a whole run.

## Async Execution (v2) — Mental Model

There are two runners selected per-user by `selectWorkbenchRunnerVersion`
(`WORKBENCH_RUNNER_VERSION`, `RUNNER_V2_USER_ALLOWLIST`,
`RUNNER_V2_USER_COHORT_PERCENT`):

- **v1**: in-request execution.
- **v2**: durable async. `execution-runs.ts` persists an `ExecutionRun` and its
  `ExecutionRunStep`s, then QStash invokes the internal worker route
  (`/api/internal/workbench/run-steps/[stepId]/execute`) per step, HMAC-signed
  and guarded by `INTERNAL_WORKER_SECRET`. A **watchdog** re-drives stalled runs.

When touching run logic, check which runner path you are in and keep v1/v2
behavior consistent.

## Data Model Highlights (`prisma/schema.prisma`)

Ownership-scoped product models: `User`, `AuthAccount`, `AuthSession`,
`Project`, `WorkbenchSession`, `WorkflowStep`, `Result` (tree via
`parentResultId`), `Preset`, `SessionAttachment`, `ResultAttachment`,
`SharedLink`, `AiRequest`.

Execution: `ExecutionRun`, `ExecutionRunStep`, `ProviderLease`.

Billing/usage: `UserSubscription`, `PlanType`/`BillingType`, `PaymentPlan`,
`CreditWallet`, `SubscriptionLedger`, `UsageLimit`, `UsageReservation`,
`UsageLog`, `TrialAccess`, `Coupon`, `CouponRedemption`.

Admin: `AdminSession`, `AdminAuditLog`, `AdminContentAccessLog`,
`AdminProviderConfig`, `AdminSystemSetting`.

Datasource is **postgresql** with `url` (pooled) + `directUrl` (migrations).

## Hosts & Routing (`proxy.ts`)

- `admin.*` host → rewrites non-`/admin`/`/api`/`/_next` paths under `/admin`.
- Canonical-host redirect logic keeps auth sessions across the
  `qkiki.vercel.app` → `qkiki.wideget.net` move (see `canonical-host.ts` and the
  redirects in `next.config.ts`).
- Public routes: `/`, `/sign-in`, `/sign-up`, `/guide`, `/shared/[token]`.
  Protected: `/app/*`. Admin: `/admin/*`.

## Commands

```bash
npm install               # also runs prisma generate (postinstall)
npm run dev               # next dev
npm run build             # prebuild migrate (prod only) + next build
npm run start             # next start
npm run lint              # eslint
npm run db:generate       # prisma generate
npm run db:migrate        # prisma migrate dev
npm run db:studio         # prisma studio
npm run user:reset-password
```

There is **no aggregate test runner** in `package.json`. Tests are standalone
Node files (`*.test.mjs` under `src/lib` and `src/lib/ai`) run directly with
`node <file>` (e.g. `node src/lib/provider-concurrency.test.mjs`). UI/flows are
verified with Playwright screenshots saved under `Report/`.

## Environment Variables

See `.env.example`. Required: `DATABASE_URL`, `DIRECT_URL`, `APP_SECRET`,
`DB_ENCRYPTION_KEY` (must differ from `APP_SECRET`), `APP_BASE_URL` /
`CANONICAL_APP_URL`. Async runs need `QSTASH_TOKEN`,
`QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`,
`INTERNAL_WORKER_SECRET`. Optional provider keys
(`OPENAI_API_KEY`/`ANTHROPIC_API_KEY`/`GOOGLE_API_KEY`/`XAI_API_KEY`) take
priority over per-user encrypted keys. Google OAuth + admin bootstrap
(`INITIAL_ADMIN_EMAILS`, `ADMIN_MFA_CODE`) and limit knobs
(`TRIAL_*`, `FREE_USER_DAILY_TOKEN_LIMIT`) are also configured here.

## Conventions & Guardrails

- **Read the bundled Next.js docs** (`node_modules/next/dist/docs/`) before
  writing Next.js code — APIs in this version differ from training data.
- **Security:** provider keys are server-only and AES-256-GCM encrypted; all API
  routes derive ownership from the session and validate it before read/mutate;
  admin uses a separate session + MFA + audit log.
- **i18n:** the product is bilingual **English/Korean** via
  `components/i18n` (`LanguageProvider`/`LanguageSelector`), persisted in the
  browser. Add both languages for user-visible strings, and keep Korean
  fallback error messages for client-visible failures.
- **Versioning (from AGENTS.md — applies to every code change):** bump the
  `vMAJOR.MINOR.PATCH-YYYYMMDD` version, update the root `VERSION` file **and**
  `src/lib/version.ts` (`APP_VERSION`, surfaced in the UI/About), and add a
  `Report/Report_v{version}_{YYYYMMDD}.md` work report.
- Match the surrounding code's style, naming, and comment density. Use the
  dedicated server adapters and Zod schemas rather than ad-hoc fetches/parsing.

## Background Docs

`README.md`, `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_PLAN.md`, and
`CHANGELOG.md` give product/history context but **predate the Postgres + QStash
+ admin + billing evolution** in places (e.g. SQLite, the old "Multi AI" name).
When they disagree with the code, **trust the code** and update the doc.
