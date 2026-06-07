# Multi AI Code Structure For External AI Review

## 1. Purpose of this file

This file is an implementation map for another AI reviewer. It focuses on where the logic lives in the repository and what responsibility each code area currently carries.

It is intentionally structural and exhaustive at the module level.

## 2. Top-level repository structure

```text
AGENTS.md
CHANGELOG.md
README.md
VERSION
docs/
prisma/
public/
scripts/
src/
storage/
task/
```

### Top-level meaning

- `AGENTS.md`: local operating instructions for AI coding agents
- `CHANGELOG.md`: human patch history
- `README.md`: product/setup overview
- `VERSION`: current app version string
- `docs/`: architecture and review documents
- `prisma/`: schema and migrations
- `scripts/`: maintenance scripts
- `src/`: application code
- `storage/`: runtime attachment storage
- `task/`: original master specs and planning notes

## 3. Design and review documents

```text
docs/ARCHITECTURE.md
docs/CODE_REVIEW_REPORT_2026-04-14.md
docs/IMPLEMENTATION_PLAN.md
docs/PROGRAM_PURPOSE_FOR_AI_REVIEW_2026-05-20.md
docs/DETAILED_STRUCTURE_DESIGN_FOR_AI_REVIEW_2026-05-20.md
docs/CODE_STRUCTURE_FOR_AI_REVIEW_2026-05-20.md
```

## 4. Original planning/spec files

```text
task/260414_01.txt
task/multi_ai_workbench_master_spec_2026-04-12.md
task/multi_ai_program_master_spec_2026-04-14.md
task/작업.txt
```

### Review note

If another AI wants to understand why repeat blocks, stop conditions, and chain review exist, these `task/` files are essential.

## 5. Database layer

### Core files

```text
prisma/schema.prisma
prisma/migrations/*
```

### Major schema domains

- auth and account: `User`, `AuthAccount`, `AuthSession`
- admin auth and audit: `AdminSession`, `AdminAuditLog`, `AdminContentAccessLog`
- orchestration core: `WorkbenchSession`, `WorkflowStep`, `Result`, `ExecutionRun`
- organization: `Project`, `Preset`
- attachment system: `SessionAttachment`, `ResultAttachment`
- provider/request accounting: `AiRequest`, `ProviderLease`, `AdminProviderConfig`
- usage and plans: `UsageLimit`, `UsageReservation`, `UsageLog`, `UserSubscription`, `CreditWallet`, `PaymentPlan`, `SubscriptionLedger`
- operations/coupons/trial: `Coupon`, `CouponRedemption`, `TrialAccess`, `AdminSystemSetting`

### Migration timeline currently present

```text
20260412143828_init
20260413020117_add_projects
20260414025326_add_admin_system
20260414090000_align_spec_kr_operations
20260505152000_add_trial_access
20260511230000_add_usage_policy_v1
20260512090000_add_coupon_daily_limit_variants
20260513150000_add_workbench_output_language
20260514090000_add_attachment_data_base64
20260514193000_add_execution_runs
20260514221500_add_workbench_workflow_control
20260516160000_add_execution_run_step_control
20260518093000_add_result_execution_run_id
20260519193000_add_workflow_template_steps
20260519194000_add_result_execution_order
```

## 6. Application route structure

### Public app routes

```text
src/app/layout.tsx
src/app/page.tsx
src/app/sign-in/page.tsx
src/app/sign-up/page.tsx
src/app/guide/page.tsx
src/app/open-in-browser/page.tsx
src/app/open-in-browser/OpenInBrowserClient.tsx
```

### Protected user app routes

```text
src/app/app/layout.tsx
src/app/app/page.tsx
src/app/app/workbench/page.tsx
src/app/app/projects/page.tsx
src/app/app/projects/[id]/page.tsx
src/app/app/sessions/page.tsx
src/app/app/presets/page.tsx
src/app/app/account/page.tsx
src/app/app/pricing/page.tsx
```

### Admin page routes

```text
src/app/admin/layout.tsx
src/app/admin/sign-in/page.tsx
src/app/admin/(panel)/layout.tsx
src/app/admin/(panel)/loading.tsx
src/app/admin/(panel)/page.tsx
src/app/admin/(panel)/about/page.tsx
src/app/admin/(panel)/audit-logs/page.tsx
src/app/admin/(panel)/conversations/page.tsx
src/app/admin/(panel)/conversations/[id]/page.tsx
src/app/admin/(panel)/coupons/page.tsx
src/app/admin/(panel)/providers/page.tsx
src/app/admin/(panel)/users/page.tsx
src/app/admin/(panel)/users/[id]/page.tsx
```

### Durable workflow runtime metadata

```text
src/app/.well-known/workflow/v1/*
```

This is runtime integration metadata for the durable `workflow` package.

## 7. API route structure

### Auth and account

```text
src/app/api/auth/sign-up/route.ts
src/app/api/auth/sign-in/route.ts
src/app/api/auth/sign-out/route.ts
src/app/api/auth/health/route.ts
src/app/api/auth/google/start/route.ts
src/app/api/auth/google/callback/route.ts
src/app/api/account/route.ts
src/app/api/trial/start/route.ts
src/app/api/subscription/route.ts
src/app/api/usage/route.ts
```

### User workbench domain

```text
src/app/api/workbench/run/route.ts
src/app/api/workbench/branch/route.ts
src/app/api/workbench/compare/route.ts
src/app/api/workbench/runs/[runId]/route.ts
src/app/api/workbench/runs/[runId]/stream/route.ts
src/app/api/workbench/runs/[runId]/steps/[stepIndex]/route.ts
src/app/api/results/[id]/route.ts
src/app/api/results/[id]/rerun/route.ts
src/app/api/results/[id]/mark-final/route.ts
src/app/api/sessions/route.ts
src/app/api/sessions/[id]/route.ts
src/app/api/sessions/[id]/duplicate/route.ts
src/app/api/presets/route.ts
src/app/api/presets/[id]/route.ts
src/app/api/projects/route.ts
src/app/api/projects/[id]/route.ts
src/app/api/attachments/route.ts
src/app/api/attachments/[id]/route.ts
src/app/api/coupons/redeem/route.ts
src/app/api/providers/route.ts
```

### Admin APIs

```text
src/app/api/admin/auth/sign-in/route.ts
src/app/api/admin/auth/sign-out/route.ts
src/app/api/admin/dashboard/route.ts
src/app/api/admin/audit-logs/route.ts
src/app/api/admin/users/route.ts
src/app/api/admin/users/[id]/route.ts
src/app/api/admin/users/[id]/grants/route.ts
src/app/api/admin/conversations/route.ts
src/app/api/admin/conversations/[id]/route.ts
src/app/api/admin/conversations/[id]/raw/route.ts
src/app/api/admin/coupons/route.ts
src/app/api/admin/coupons/[id]/route.ts
src/app/api/admin/coupons/[id]/deactivate/route.ts
src/app/api/admin/providers/route.ts
src/app/api/admin/providers/[providerName]/health-check/route.ts
src/app/api/admin/system/settings/route.ts
```

## 8. Component structure

### Shared shell and utility components

```text
src/components/AppShell.tsx
src/components/AuthForm.tsx
src/components/EmptyState.tsx
src/components/SectionHeader.tsx
src/components/SignOutButton.tsx
src/components/StatusBadge.tsx
```

### Workbench components

```text
src/components/workbench/WorkbenchClient.tsx
src/components/workbench/ProviderSelectorRow.tsx
src/components/workbench/WorkflowStepRow.tsx
src/components/workbench/ResultCard.tsx
```

Responsibilities:

- main orchestration UI state
- model selection
- sequential workflow builder
- repeat block and stop-condition controls
- attachment upload UI
- run streaming integration
- result board and branch actions

### Project/session/preset/account components

```text
src/components/projects/ProjectsClient.tsx
src/components/projects/ProjectDetailClient.tsx
src/components/sessions/SessionsClient.tsx
src/components/presets/PresetsClient.tsx
src/components/account/AccountClient.tsx
```

### Billing and language components

```text
src/components/billing/LimitReachedModal.tsx
src/components/billing/UsageStatus.tsx
src/components/i18n/LanguageProvider.tsx
src/components/i18n/LanguageSelector.tsx
```

### Admin components

```text
src/components/admin/AdminShell.tsx
src/components/admin/AdminAuthForm.tsx
src/components/admin/AdminSignInCard.tsx
src/components/admin/AdminSignOutButton.tsx
src/components/admin/AdminDashboardClient.tsx
src/components/admin/AdminUsersClient.tsx
src/components/admin/AdminUserDetailClient.tsx
src/components/admin/AdminUserActions.tsx
src/components/admin/AdminConversationsClient.tsx
src/components/admin/AdminConversationDetailClient.tsx
src/components/admin/AdminConversationRawViewer.tsx
src/components/admin/AdminCouponsClient.tsx
src/components/admin/AdminProvidersClient.tsx
src/components/admin/AdminAuditLogsClient.tsx
```

## 9. Core library structure

### AI domain

```text
src/lib/ai/types.ts
src/lib/ai/action-display.ts
src/lib/ai/model-display.ts
src/lib/ai/pricing.ts
src/lib/ai/prompt.ts
src/lib/ai/provider-catalog.ts
src/lib/ai/providers.ts
src/lib/ai/workflow-control.ts
src/lib/ai/workflow.ts
```

Responsibilities:

- shared AI types
- action/model display labels
- model pricing estimates
- prompt composition
- provider catalog and timeout rules
- provider adapter execution, retry, and normalization
- repeat block expansion
- orchestration execution logic

### Auth and access

```text
src/lib/auth.ts
src/lib/auth-config.ts
src/lib/auth-constants.ts
src/lib/api-auth.ts
src/lib/google-oauth.ts
src/lib/admin-auth.ts
src/lib/admin-api-auth.ts
src/lib/access-policy.ts
```

Responsibilities:

- password/session auth
- cookies
- Google OAuth
- trial access
- admin session and role gates
- API-friendly auth error handling

### Persistence, crypto, and schema helpers

```text
src/lib/prisma.ts
src/lib/secret-crypto.ts
src/lib/workbench-session-schema.ts
src/lib/workbench-run-schema.ts
src/lib/workbench-result-read.ts
src/lib/workbench-run-watchdog.ts
```

Responsibilities:

- Prisma client access
- encrypted secret handling
- runtime schema capability checks and defensive auto-adds
- result select helpers
- stale durable-run cleanup

### Execution, usage, provider operations

```text
src/lib/execution-runs.ts
src/lib/provider-availability.ts
src/lib/provider-concurrency.ts
src/lib/usage-policy.ts
src/lib/usage-types.ts
src/lib/subscription.ts
src/lib/admin-dashboard.ts
src/lib/admin-audit.ts
```

Responsibilities:

- durable run lifecycle and signed run tokens
- provider readiness and daily gates
- provider lease concurrency control
- usage reservation/settlement policies
- subscription and coupon logic
- admin dashboard aggregation
- audit log writing

### Attachments and client cache

```text
src/lib/attachments.ts
src/lib/local-cache.ts
src/lib/browser-detection.ts
src/lib/validation.ts
src/lib/version.ts
```

Responsibilities:

- server-side attachment storage/extraction/linking
- local workbench draft cache
- browser helpers
- zod validation schemas
- visible app version

## 10. Durable workflow implementation

```text
src/workflows/workbench-run.ts
```

This is the durable execution entrypoint. It bridges:

- `ExecutionRun` state
- workflow runtime streaming
- parallel/sequential orchestration functions
- usage settlement/release
- per-step and whole-run stop handling

## 11. Scripts and maintenance files

```text
scripts/reset-password.mjs
```

Purpose:

- interactive password reset helper for a user account

## 12. Static assets

```text
public/file.svg
public/globe.svg
public/next.svg
public/vercel.svg
public/window.svg
src/app/favicon.ico
```

## 13. Most critical code paths for architecture review

If another AI cannot read everything, these files are the minimum high-signal set:

1. `task/multi_ai_program_master_spec_2026-04-14.md`
2. `task/multi_ai_workbench_master_spec_2026-04-12.md`
3. `prisma/schema.prisma`
4. `src/lib/validation.ts`
5. `src/lib/ai/workflow-control.ts`
6. `src/lib/ai/workflow.ts`
7. `src/lib/ai/providers.ts`
8. `src/lib/execution-runs.ts`
9. `src/lib/usage-policy.ts`
10. `src/components/workbench/WorkbenchClient.tsx`
11. `src/workflows/workbench-run.ts`
12. `src/app/api/workbench/run/route.ts`
13. `src/app/api/workbench/runs/[runId]/route.ts`
14. `src/app/api/workbench/runs/[runId]/stream/route.ts`
15. `src/app/api/workbench/runs/[runId]/steps/[stepIndex]/route.ts`

## 14. Architectural reading order recommendation

For fastest comprehension, read in this order:

1. `docs/PROGRAM_PURPOSE_FOR_AI_REVIEW_2026-05-20.md`
2. `docs/DETAILED_STRUCTURE_DESIGN_FOR_AI_REVIEW_2026-05-20.md`
3. `prisma/schema.prisma`
4. `src/lib/validation.ts`
5. `src/lib/ai/workflow-control.ts`
6. `src/lib/ai/workflow.ts`
7. `src/lib/execution-runs.ts`
8. `src/workflows/workbench-run.ts`
9. `src/components/workbench/WorkbenchClient.tsx`
10. admin, usage, provider, and subscription modules as needed

## 15. Bottom line

The repository is organized around one central orchestration spine:

`validated request -> session -> execution run -> workflow execution -> result persistence -> branch/review/rerun -> usage settlement -> admin visibility`

That is the code structure another AI reviewer should inspect.
