# Project Conversation Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mobile-friendly delete choice to every project conversation card, allowing safe project-only removal or explicitly confirmed permanent deletion.

**Architecture:** A focused service performs project-only unlinking inside a Prisma transaction and is called by a new authenticated Route Handler. The project client owns a small accessible choice modal and updates its local project snapshot through a tested pure helper after either operation succeeds.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma 6, Node test runner, Tailwind CSS, Vercel

---

### Task 1: Add the project unlink service with regression tests

**Files:**
- Modify: `package.json`
- Create: `src/lib/project-session-removal.ts`
- Test: `src/lib/project-session-removal.test.mjs`

- [ ] **Step 1: Add a test script and write failing service tests**

Add `"test": "node --test --experimental-strip-types"` to `package.json`. Create tests that import `removeSessionFromProject` and use an in-memory transaction double. Assert that a matching session is changed to `projectId: null`, matching `ProjectItem` rows are deleted, and a non-matching session returns `false` without deleting items.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test --experimental-strip-types src/lib/project-session-removal.test.mjs`

Expected: FAIL because `src/lib/project-session-removal.ts` does not exist.

- [ ] **Step 3: Implement the minimal transaction service**

Create `removeSessionFromProject({ db, userId, projectId, sessionId })`. Inside `db.$transaction`, call `workbenchSession.updateMany` with `{ id: sessionId, userId, projectId }`; return `false` when `count !== 1`; otherwise call `projectItem.deleteMany` with `{ projectId, userId, sessionId }` and return `true`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test --experimental-strip-types src/lib/project-session-removal.test.mjs`

Expected: 2 tests pass, 0 fail.

### Task 2: Add the authenticated project session DELETE route

**Files:**
- Create: `src/app/api/projects/[id]/sessions/[sessionId]/route.ts`

- [ ] **Step 1: Implement the Route Handler against the tested service**

Export `DELETE(_request, context)`, call `requireApiUser()`, await `context.params`, and pass `prisma`, `user.id`, `id`, and `sessionId` to `removeSessionFromProject`. Return `{ error: "Session not found in project." }` with status 404 when the service returns false, `{ ok: true }` otherwise, and route thrown errors through `apiErrorResponse`.

- [ ] **Step 2: Run service tests and typecheck**

Run: `npm test -- src/lib/project-session-removal.test.mjs`

Expected: 2 tests pass, 0 fail.

Run: `npx tsc -p tsconfig.json --noEmit`

Expected: exit 0.

### Task 3: Add tested client snapshot updates and the mobile choice modal

**Files:**
- Create: `src/lib/project-detail-state.ts`
- Test: `src/lib/project-detail-state.test.mjs`
- Modify: `src/components/projects/ProjectDetailClient.tsx`

- [ ] **Step 1: Write failing snapshot helper tests**

Test `withoutProjectSession(project, sessionId)` with one matching and one missing session. The matching case must remove exactly that session and decrement `_count.sessions` without going below zero. The missing case must return unchanged session content and count.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test --experimental-strip-types src/lib/project-detail-state.test.mjs`

Expected: FAIL because `src/lib/project-detail-state.ts` does not exist.

- [ ] **Step 3: Implement the pure snapshot helper**

Export structural `ProjectWithSessions` types and `withoutProjectSession<T extends ProjectWithSessions>(project: T, sessionId: string): T`. Filter sessions, detect whether a row was removed, and only then decrement the count with `Math.max(0, count - 1)`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test --experimental-strip-types src/lib/project-detail-state.test.mjs`

Expected: 2 tests pass, 0 fail.

- [ ] **Step 5: Add the per-card delete choice**

In `ProjectDetailClient`, add state for `selectedSession`, `removalStage` (`"choose" | "confirm-permanent"`), and `removalAction` (`"unlink" | "permanent" | null`). Add a rose-bordered full-width mobile `삭제` button beside `열기` on every session card.

The first dialog must use `role="dialog"`, `aria-modal="true"`, show the conversation title, and provide `프로젝트에서만 제거`, `원본까지 영구 삭제`, and `취소`. The permanent choice opens a second warning stage with `영구 삭제` and `돌아가기`. Use localized strings for English, Korean, Japanese, and Spanish.

- [ ] **Step 6: Wire both server actions**

Project-only removal calls `DELETE /api/projects/${projectId}/sessions/${sessionId}`. Permanent removal calls the existing `DELETE /api/sessions/${sessionId}` only from the second confirmation stage. On success, update state with `withoutProjectSession`, close the dialog, and show a notice. On failure, keep the dialog open, show an error, and restore enabled controls.

### Task 4: Version, report, and verify the release

**Files:**
- Modify: `VERSION`
- Modify: `src/lib/version.ts`
- Create: `Report/Report_v1.36.0_20260706.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Bump the visible version**

Set `VERSION` and `APP_VERSION` to `v1.36.0-20260706`. Add a changelog entry describing the project-only unlink choice, permanent-delete confirmation, API ownership checks, and mobile layout.

- [ ] **Step 2: Write the Korean work report**

Record previous version `v1.35.0-20260702`, new version `v1.36.0-20260706`, changed files, tests, and deployment/live verification results in `Report/Report_v1.36.0_20260706.md`.

- [ ] **Step 3: Run complete local verification**

Run: `npm test`

Expected: all tests pass.

Run: `npx tsc -p tsconfig.json --noEmit`

Expected: exit 0.

Run: `npm run lint`

Expected: exit 0.

Run: `npm run build`

Expected: exit 0.

Run: `git diff --check`

Expected: exit 0.

- [ ] **Step 4: Verify the mobile UI in a real browser**

Start the app with the production-shaped environment. At a mobile viewport, open an authenticated project containing sessions; verify every card shows `열기` and `삭제`, the choice dialog fits the viewport, project-only removal updates the card count, and permanent deletion cannot run without the second confirmation.

- [ ] **Step 5: Commit implementation and release metadata**

Commit the tested implementation with message `feat: add project conversation removal choices`.

- [ ] **Step 6: Push, deploy, and verify production**

Push the branch, run `vercel --prod --yes`, confirm `vercel inspect` reports Ready, and verify `https://yapp.wideget.net` plus the task-specific project page. Confirm the live guide/footer exposes `v1.36.0-20260706`.
