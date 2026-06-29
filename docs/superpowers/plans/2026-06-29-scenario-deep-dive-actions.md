# Scenario Development and Deep Dive Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add scenario-development and deep-dive actions that genuinely carry multi-model state forward across v1, v2, and branch execution paths.

**Architecture:** Centralize action metadata, add semantic source provenance, and let prompt policy distinguish initial, continuation, competing-result, and fallback contexts. In v2, preserve the latest handoff as its own source block and evaluate research intent against resolved source text before composing the prompt.

**Tech Stack:** Next.js 16.2.3, React 19, TypeScript, Zod 4, Node test runner, Prisma-backed workflow runtime, Vercel.

---

### Task 1: Central action metadata and validation

**Files:**
- Modify: `src/lib/ai/types.ts`
- Modify: `src/lib/validation.ts`
- Modify: `src/lib/ai/action-display.ts`
- Create: `src/lib/ai/action-metadata.test.mjs`
- Create: `src/lib/validation-actions.test.mjs`

- [ ] Write failing tests proving both actions exist in workflow and branch lists, have bilingual labels, and pass both Zod schemas.
- [ ] Run `node --test src/lib/ai/action-metadata.test.mjs src/lib/validation-actions.test.mjs` and confirm missing-action failures.
- [ ] Add shared runtime tuples and labels, derive `ActionType`, and consume tuples from validation.
- [ ] Re-run the focused tests and confirm they pass.

### Task 2: Semantic source provenance

**Files:**
- Create: `src/lib/ai/source-context.ts`
- Create: `src/lib/ai/source-context.test.mjs`
- Modify: `src/lib/ai/workflow.ts`
- Modify: `src/lib/execution-run-steps.ts`

- [ ] Write failing provenance matrix tests for original, valid prior result, multiple results, and original fallback.
- [ ] Run `node --test src/lib/ai/source-context.test.mjs` and confirm the classifier is missing.
- [ ] Implement `SourceContextKind`, pure classification, and `{ text, kind }` resolver outputs in v1/v2.
- [ ] Pass `prior_result` for result branches.
- [ ] Re-run provenance tests and existing workflow-focused tests.

### Task 3: Scenario and deep-dive prompt policy

**Files:**
- Modify: `src/lib/ai/prompt.ts`
- Modify: `src/lib/ai/prompt.test.mjs`

- [ ] Add failing tests for each action's initial, continuation, prior-results, and fallback behavior plus non-leakage.
- [ ] Run `node --test src/lib/ai/prompt.test.mjs` and confirm expected prompt-marker failures.
- [ ] Implement action labels, source headings, scenario protocol, deep-dive protocol, claim labels, conflict rules, and anti-bloat limits.
- [ ] Re-run prompt tests and confirm all pass.

### Task 4: Research intent from separately resolved source

**Files:**
- Modify: `src/lib/ai/prompt.ts`
- Modify: `src/lib/ai/provider-web-search.ts`
- Modify: `src/lib/ai/provider-web-search.test.mjs`
- Modify: `src/lib/ai/workflow.ts`
- Modify: `src/lib/execution-run-steps.ts`

- [ ] Add failing tests showing timestamp-only prompts do not browse, stable deep dives do not browse, and current claims found only in v2 resolved source do browse.
- [ ] Run the search tests and confirm the timestamp/source failures.
- [ ] Remove the timestamp activation marker and pass resolved source as research-only context into prompt policy.
- [ ] Re-run prompt and provider-search tests.

### Task 5: Latest-handoff token preservation

**Files:**
- Modify: `src/lib/ai/token-budget.ts`
- Create: `src/lib/ai/token-budget.test.mjs`
- Modify: `src/lib/execution-run-steps.ts`

- [ ] Add failing tests with oversized older results and a complete latest handoff.
- [ ] Run `node --test src/lib/ai/token-budget.test.mjs` and confirm overflow/preservation failures.
- [ ] Split latest and older source blocks, trim older context first, add last-resort highest-block shrinking, and enforce `estimatedInputTokens <= tokenBudget`.
- [ ] Re-run token-budget and source-context tests.

### Task 6: UI, presets, guide, and credit estimates

**Files:**
- Modify: `src/components/workbench/WorkflowStepRow.tsx`
- Modify: `src/components/workbench/ResultCard.tsx`
- Modify: `src/components/presets/PresetsClient.tsx`
- Modify: `src/app/guide/page.tsx`
- Modify: `src/lib/credits.ts`
- Modify: `src/lib/credits.test.mjs`

- [ ] Add failing metadata/credit tests for selector lists and 3000/2400 estimates.
- [ ] Run focused tests and confirm failures.
- [ ] Consume shared action lists/labels in UI and presets, update both guide languages, and add estimates.
- [ ] Re-run focused tests, TypeScript, and lint.

### Task 7: Version and release artifacts

**Files:**
- Modify: `VERSION`
- Modify: `src/lib/version.ts`
- Modify: `CHANGELOG.md`
- Create: `Report/Report_v1.35.0_20260629.md`

- [ ] Set `v1.35.0-20260629` in root and app-visible version files.
- [ ] Record feature logic, two-round model review, tests, known limits, and deployment result.
- [ ] Run all focused tests, `node --test`, `npx tsc -p tsconfig.json --noEmit`, `npm run lint`, `npm run build`, and `git diff --check`.

### Task 8: Scoped commit, push, deploy, and live verification

**Files:**
- Commit only files owned by this feature; preserve unrelated dirty-worktree changes.

- [ ] Review the staged diff and commit design and implementation in intentional scoped commits.
- [ ] Push the current branch safely, rebasing only if required and without discarding unrelated changes.
- [ ] Deploy a clean committed snapshot with `vercel --prod --yes`.
- [ ] Confirm `vercel inspect` is `Ready` and live aliases return expected HTTP status.
- [ ] Open the production workbench and verify both action labels are present; run a task-specific live smoke if credentials permit.
