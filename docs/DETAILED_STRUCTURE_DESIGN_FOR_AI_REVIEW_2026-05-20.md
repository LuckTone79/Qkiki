# Multi AI Detailed Structure Design For External AI Review

## 1. Review scope

This document summarizes the current design as it exists across the task specs, architecture notes, Prisma schema, API routes, workflow engine, and UI.

It is written for external review. It aims to describe the actual designed behavior, including areas where the repository appears broader or more evolved than the original specs.

## 2. Design source hierarchy

Current design intent is spread across these sources:

1. `task/multi_ai_workbench_master_spec_2026-04-12.md`
2. `task/multi_ai_program_master_spec_2026-04-14.md`
3. `task/260414_01.txt`
4. `docs/ARCHITECTURE.md`
5. `README.md`
6. `prisma/schema.prisma`
7. `src/lib/ai/workflow.ts`
8. `src/lib/validation.ts`
9. `src/components/workbench/WorkbenchClient.tsx`
10. `src/workflows/workbench-run.ts`

The Korean master spec is the broader product/operations vision. The English workbench spec is the clearest explanation of the workbench interaction model. The codebase then extends both with durable runs, usage reservations, project context injection, attachments, and admin operations.

## 3. Product architecture overview

### 3.1 High-level layers

The current structure can be read as six layers:

1. Public and authenticated UI routes in `src/app`
2. Domain UI components in `src/components`
3. Route validation, auth, usage, and admin services in `src/lib`
4. AI orchestration engine in `src/lib/ai`
5. Durable workflow runtime in `src/workflows`
6. Persistence in Prisma/Postgres schema and migrations

### 3.2 Core design axis

The system is centered on persisted session/result state, not on live chat state.

The dominant entities are:

- `WorkbenchSession`
- `WorkflowStep`
- `Result`
- `ExecutionRun`
- `Project`
- `Preset`

## 4. Main runtime objects and intended semantics

### 4.1 User

Represents the account owner. Carries auth state, role, plan, trial markers, usage, sessions, projects, presets, admin relations, attachments, and subscriptions.

### 4.2 WorkbenchSession

Represents one saved workbench task space. It stores:

- original input
- additional instruction
- output style
- output language
- execution mode
- optional workflow control JSON
- optional workflow template steps JSON
- final selected result id
- optional linked project

Design meaning:

- the session is the stable container
- many execution runs may happen against one session
- results belong to the session and may form a branch tree

### 4.3 WorkflowStep

Represents a configured sequential step template associated with a session. Fields include:

- `orderIndex`
- `actionType`
- `targetProvider`
- `targetModel`
- `sourceMode`
- `sourceResultId`
- `instructionTemplate`

Current design tension:

- it is used partly as a saved workflow template
- it is also associated with actual results
- the code tries to keep execution order and template order coherent, but the model may still be doing two jobs

### 4.4 Result

Represents one model output or one failed output slot. It stores:

- provider/model
- prompt snapshot
- output text
- raw response
- status/error
- token usage
- cost estimate
- latency
- workflow step link
- execution run link
- execution order
- parent result id
- branch key

Design meaning:

- every output becomes first-class persistent state
- branch trees are built through `parentResultId`
- reruns preserve prompt snapshot and create new results

### 4.5 ExecutionRun

Represents one durable run execution. It stores:

- mode
- request type
- queued/running/completed/partial/failed/canceled status
- planned and completed step counts
- workflow runtime id
- final result id
- stream error and summary
- optional step control JSON
- optional usage reservation id

Design meaning:

- execution state is separated from session state
- the UI can poll and stream progress against a signed run token
- sequential runs can be canceled entirely or stopped at step granularity

### 4.6 Project

Represents a folder-like grouping layer above sessions. It stores:

- name
- description
- shared context

Design meaning:

- related sessions are grouped
- project shared context and recent sibling outputs may influence prompt composition

### 4.7 Preset

Stores saved workflow JSON so users can reuse orchestration routes.

## 5. Supported end-user logic

### 5.1 Authentication and access

Current user auth supports:

- email/password sign-up and sign-in
- Google OAuth
- secure HttpOnly session cookies
- trial sessions

Access rules:

- public routes for landing/auth/guide
- protected `/app/*` routes
- separate admin auth and admin session cookie

### 5.2 Parallel compare logic

Input:

- original input
- optional additional instruction
- optional output style
- optional output language
- selected provider/model targets
- optional attachments

Behavior:

1. Validate request.
2. Check provider availability and limits.
3. Reserve usage if needed.
4. Upsert the session.
5. Create a queued durable execution run.
6. Start durable workflow runtime.
7. Execute all selected targets in parallel.
8. Persist a result record per target, including failures.
9. Stream progress and results to the UI.
10. Settle usage on completion.

Expected design properties:

- partial failure tolerance
- persistent results even if one target fails
- result cards appear incrementally

### 5.3 Sequential review chain logic

Input:

- original input
- ordered step templates
- optional workflow control
- optional attachments

Each step defines:

- action type: generate, critique, fact_check, improve, summarize, simplify, consistency_review, follow_up
- target provider/model
- source mode: original, previous, selected_result, all_results
- optional source result id
- optional step instruction template

Behavior:

1. Expand step templates according to repeat settings.
2. Execute steps in order.
3. Resolve source text for each step.
4. Compose prompt for each step.
5. Persist each result with execution order.
6. Optionally stop early if stop condition is met.
7. Stream per-step progress and results.

### 5.4 Repeat block design

The design currently supports:

- legacy single repeat config
- normalized multiple `repeatBlocks`
- maximum 10 repeat blocks
- maximum 50 total sequential executions after expansion

Expansion logic in `src/lib/ai/workflow-control.ts` duplicates the selected step range `repeatCount` times and rejects out-of-bounds or oversized plans.

### 5.5 Early stop condition design

The design currently supports:

- one stop condition
- enabled flag
- `checkStepOrder`
- `qualityThreshold` from 0 to 100

Intended behavior:

- the designated step self-reports a quality score
- if the score reaches the threshold, the remaining repeated chain can stop early

This is a design-critical area because it introduces self-evaluation, prompt conventions, and execution control coupling.

### 5.6 Branch logic

Any saved result can spawn new child results using another action type and one or more selected models.

Branch modes currently cover:

- critique
- fact-check style review
- improve
- summarize
- simplify
- consistency review
- follow-up

### 5.7 Rerun logic

Any saved result can be rerun using:

- the same provider
- the same model
- the same persisted prompt snapshot
- the same linked attachments

This produces a new result instead of mutating the original one.

### 5.8 Final selection logic

Any result in a session can be marked as the final result by writing its id into `WorkbenchSession.finalResultId`.

### 5.9 Parallel comparison summary logic

After parallel results exist, the system can run an additional OpenAI-backed comparison summary across the top-level parallel outputs. This is separate from the original model outputs and acts like a synthesized review layer.

## 6. Prompt design

Prompt composition currently combines:

- action label
- original user task
- optional additional instruction
- optional project context
- optional requested output style
- optional requested output language
- optional source result text
- optional step-specific instruction

Prompt composition principles encoded in code:

- the orchestration role is explicit
- uncertainty should be acknowledged
- tool access should not be invented
- outputs should return useful response content only

Project-aware behavior:

- project shared notes are included
- recent sibling completed results may be digested into prompt context

## 7. Attachment design

Supported attachment kinds:

- text
- image
- PDF

Current rules:

- max 8 attachments per run
- max 20 MB per file
- text/JSON/CSV/Markdown are decoded to extracted text
- PDFs are text-extracted via `pdf-parse`
- images are stored with base64 data for multimodal provider calls
- extracted text is truncated before prompt injection

Design meaning:

- attachments are session-level persisted resources
- results can link to attachments
- reruns and branches can reuse them

## 8. Provider design

### 8.1 Supported providers

Current catalog:

- OpenAI
- Anthropic
- Google
- xAI

### 8.2 Provider abstraction responsibilities

`src/lib/ai/providers.ts` handles:

- API key resolution
- default/fallback model logic
- request construction per provider
- multimodal attachment forwarding
- timeout handling
- retry behavior
- normalized usage and cost extraction
- normalized completed/failed result payloads

### 8.3 Provider readiness gate

Before a run, `assertProvidersReadyForRun()` checks:

- provider is enabled by admin
- a credential exists in env or stored admin config
- per-user daily request limit is not exceeded

### 8.4 Provider concurrency gate

`src/lib/provider-concurrency.ts` uses `ProviderLease` rows to cap concurrent provider usage per provider with a lease-and-release design.

Default limits currently differ by provider, and the design allows env override.

## 9. Durable run design

The system has moved beyond a simple request/response model.

Current durable run behavior includes:

- queued run creation
- signed run token generation
- durable workflow runtime start
- stream endpoint for NDJSON events
- status endpoint for polling
- whole-run cancel endpoint
- per-step stop endpoint for sequential runs
- stale-run close-out watchdog

Streamed event types:

- session
- progress
- result
- usage
- done
- error

This is central to the current architecture.

## 10. Usage, plan, and trial design

### 10.1 Trial

The system supports trial sessions with:

- trial user marker
- IP-hash-backed `TrialAccess`
- conversation count limit
- forced redirect when trial quota is exhausted

### 10.2 Usage policy

The system uses plan-based request limits, not just token display.

Current policy families:

- free
- boost
- starter
- pro
- team

Tracked properties include:

- daily limit
- input character limit
- result save limit
- share daily limit
- advanced reasoning daily limit

### 10.3 Reservation/settlement model

Usage is not simply counted after the fact.

The design uses:

- usage access check
- usage reservation before run
- release if run never really starts
- settlement after results complete
- usage log creation

This is important because it ties billing logic to orchestration reliability.

## 11. Subscription and coupon design

The admin/operations layer currently includes:

- one-time coupon codes
- monthly free 30-day variants
- lifetime free variants
- optional coupon daily-limit variants
- manual grants by admin
- subscription ledger history
- revocation path on coupon deactivation or deletion

This means the repository is already a service platform design, not only a local orchestration toy.

## 12. Admin design

The admin system currently includes:

- separate admin sign-in
- MFA code requirement when configured
- admin session cookie
- role-gated viewer/manager/critical actions
- dashboard metrics
- user detail and grants
- conversation listing and detail
- raw conversation access logging
- coupon CRUD/deactivation
- provider configuration and health-check
- audit logs
- system settings endpoint

Role concept in schema:

- USER
- SUPPORT_VIEWER
- ADMIN
- SUPER_ADMIN

## 13. Security design

Security assumptions embedded in the repository:

1. Provider credentials stay server-side.
2. Stored secrets are encrypted.
3. Auth sessions use hashed tokens in DB and HttpOnly cookies in browser.
4. Admin and user sessions are separated.
5. User ownership is checked server-side in API routes.
6. Trial access uses hashed IP metadata.
7. Raw content access by admins is auditable.

## 14. Schema evolution design

The codebase shows two schema-evolution approaches at once:

1. normal Prisma migrations
2. runtime "ensure column/index exists" helpers

Runtime helpers currently auto-check or auto-add support for:

- `WorkbenchSession.workflowControlJson`
- `WorkbenchSession.workflowTemplateStepsJson`
- `ExecutionRun.stepControlJson`
- `Result.executionRunId`
- `Result.executionOrder`

This is a review hotspot because it suggests the current design is evolving quickly and sometimes defensively at runtime.

## 15. Known design drift and likely review hotspots

### 15.1 Original spec vs current provider management

Older architecture notes and README still mention per-user provider configs, but the newer Korean spec wants administrator-only provider key management. Current schema and admin UI are aligned with admin-side provider control, and older docs may be stale.

### 15.2 Session/result model vs conversation/message terminology

The Korean master spec uses `conversations/messages` terminology. The implemented model is `WorkbenchSession/Result`. This is probably intentional but should be reviewed for clarity and future maintainability.

### 15.3 Workflow template step vs execution step

The system now has:

- saved sequential template steps
- expanded execution order
- result links back to workflow steps
- step stop controls at execution-run level

This raises the question of whether a dedicated execution-step table is now warranted.

### 15.4 Runtime schema self-healing

The presence of runtime schema repair helpers may be pragmatic, but it is also a sign that migration discipline and deployment guarantees deserve review.

### 15.5 Product breadth

The repository combines:

- orchestration engine
- SaaS auth
- projects
- presets
- attachments
- subscriptions
- coupons
- admin audit
- provider operations

A reviewer should examine whether the system has become too broad for its current domain boundaries.

## 16. Reviewer checklist

An external AI reviewer should answer these concrete questions:

1. Is the result-centric architecture the right base for the product promise?
2. Is `WorkflowStep` overloaded between template and execution concerns?
3. Are repeat blocks and early-stop conditions modeled safely enough?
4. Is `ExecutionRun` enough, or is a dedicated execution-step model needed?
5. Is the branch tree model sustainable for long-lived sessions?
6. Are the usage reservation and durable run lifecycles overly coupled?
7. Are admin operations too tightly mixed into the same domain schema?
8. Which parts of the current design should be simplified before further feature growth?

## 17. Short conclusion

The current design is ambitious and already implements a real orchestration platform shape:

- compare many models
- chain models together
- repeat parts of chains
- stop early by quality threshold
- branch from results
- persist everything
- control runs durably
- wrap it in plans, limits, projects, presets, and admin operations

That full scope is what should be reviewed, not only the visible workbench UI.
