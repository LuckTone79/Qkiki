# Multi AI Program Purpose For External AI Review

## 1. Why this file exists

This file is for another AI reviewer that needs to evaluate the current product direction quickly without reverse-engineering the entire repository first.

The goal is not to advertise the product. The goal is to expose the intended purpose, the design promises, the current scope, and the review questions that matter most.

## 2. One-line product definition

Multi AI is a result-centric orchestration workbench that lets one user task be handled by multiple AI models in parallel, in sequence, or through follow-up branches so the user can compare, critique, improve, and organize outputs inside one system.

## 3. Primary product purpose

The current design is trying to solve these problems:

1. A user should not need to open many AI websites and paste the same prompt repeatedly.
2. A user should be able to compare outputs from GPT, Claude, Gemini, Grok, and similar providers in one workspace.
3. A user should be able to turn one AI result into input for another AI and build structured review chains.
4. A user should be able to preserve results, rerun them, branch from them, mark a final answer, and reopen the whole session later.
5. An operator should be able to manage provider credentials, users, coupons, subscriptions, usage, and audit trails from an admin console.

## 4. Product identity

This program is intentionally not designed as a flat chatbot transcript.

The core unit is a persisted `Result` card, not a chat message bubble. A session is therefore treated as:

- one original task
- optional additional instruction
- one execution mode
- one workflow definition
- many results that may branch into a tree

This means the design centers on:

- result comparison
- review chains
- branch-based iteration
- reusable presets
- project-level grouping and shared context

## 5. Main user-facing modes

### A. Parallel compare

One input is sent to multiple selected models at the same time. Each model returns its own result card. Partial failure is allowed, so one provider failing should not destroy the whole run.

### B. Sequential review chain

The user defines ordered workflow steps. Each step selects:

- action type
- target provider
- target model
- source mode
- optional step instruction

The next step can consume the original input, the previous output, a selected result, or all current results.

### C. Follow-up and review branches

Any result can become the parent of more results. A result can be critiqued, improved, summarized, simplified, fact-checked, consistency-reviewed, or continued through follow-up instructions.

## 6. Advanced workflow intent currently designed

The current design goes beyond simple compare mode and includes these orchestration ideas:

- repeat blocks inside sequential chains
- total sequential execution safety cap
- early stop condition based on self-reported quality score
- durable execution runs with resumable status polling and streaming
- step-level stop requests during sequential execution
- post-run comparison summary for top-level parallel outputs

These are important because the user's main review concern is whether the architecture for parallel work, self-review chains, and repetition settings is sound.

## 7. Supporting product layers

### Projects

Sessions can be grouped under a project. A project stores shared context, and recent completed results from sibling sessions can be injected into later prompts.

### Presets

Workflow routes can be saved as reusable JSON presets and loaded again later.

### Attachments

Users can attach text files, JSON, CSV, Markdown, PDF, and images. Text and PDF content is extracted server-side and injected into prompts. Images are forwarded as multimodal input where supported.

### Usage and plan controls

The system tracks usage, daily limits, trial access, reservations, settlement, and subscription state. This is part of the product behavior, not just an implementation detail.

### Admin operations

The product is also designed as an operated service, not just a personal tool. It includes:

- admin authentication with MFA gate
- user management
- coupon issuance and deactivation
- manual subscription grants
- provider configuration
- raw conversation inspection
- audit logs

## 8. Current design principles

The repository currently encodes these design principles:

1. Provider API keys must stay server-side.
2. The browser must never call providers directly.
3. Data ownership must be derived from the authenticated session, not user ids sent by the client.
4. Result persistence matters as much as model execution.
5. Durable execution and partial recovery are preferred over fire-and-forget requests.
6. The product should tolerate partial provider failure.
7. The user should be able to inspect progress while a durable run is executing.

## 9. External AI reviewer should focus on these questions

The user asked for review because they believe the current structure likely has architectural problems. A reviewer should especially examine:

1. Whether `Session -> WorkflowStep -> Result -> ExecutionRun` is the right domain model for the intended orchestration behavior.
2. Whether repeat blocks and early-stop logic are modeled safely enough for future expansion.
3. Whether sequential chain state should remain template-based or be split into template-step vs execution-step records.
4. Whether result branching and rerun behavior can remain result-centric without causing referential complexity.
5. Whether admin, billing, usage, provider, and workbench concerns are too tightly coupled.
6. Whether schema auto-repair helpers indicate migration discipline problems.
7. Whether the current design drifts from the original specs in `task/`.

## 10. Source-of-truth documents to read next

For a full review, this file should be read together with:

- `task/multi_ai_workbench_master_spec_2026-04-12.md`
- `task/multi_ai_program_master_spec_2026-04-14.md`
- `task/260414_01.txt`
- `docs/ARCHITECTURE.md`
- `docs/DETAILED_STRUCTURE_DESIGN_FOR_AI_REVIEW_2026-05-20.md`
- `docs/CODE_STRUCTURE_FOR_AI_REVIEW_2026-05-20.md`

## 11. Bottom line

The current program is designed as a managed multi-model orchestration platform whose real value comes from structured result comparison, sequential AI review chains, repeatable workflows, project memory, and durable execution control.

That is the intent another AI should review.
