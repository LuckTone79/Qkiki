# Japanese and Spanish Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add complete Japanese and Spanish application-language support, including every signed-in menu and the guidebook, then release it to Yapp production.

**Architecture:** Centralize locale definitions and locale selection in `src/lib/i18n.ts`, extend the existing provider dictionary to four locales, and replace two-language UI branches with four-locale records. Keep route and storage behavior unchanged.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Node test runner, ESLint, Vercel.

---

### Task 1: Locale foundation and regression tests

**Files:**
- Create: `src/lib/i18n.ts`
- Create: `src/lib/i18n.test.mjs`
- Modify: `src/components/i18n/LanguageProvider.tsx`
- Modify: `src/components/i18n/LanguageSelector.tsx`

- [ ] Write tests asserting `SUPPORTED_LANGUAGES` is `en`, `ko`, `ja`, `es`, stored values normalize safely, and every provider translation key exists in all four dictionaries.
- [ ] Run `node --test --experimental-strip-types src/lib/i18n.test.mjs` and confirm it fails because the locale foundation does not exist.
- [ ] Implement locale types, labels, normalization, selection helper, Japanese/Spanish provider dictionaries, and four selector options.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Public pages, application menus, and guidebook

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/guide/page.tsx`
- Modify: `src/components/AppShell.tsx`
- Modify: `src/components/AuthForm.tsx`
- Modify: `src/components/AuthEntryLinks.tsx`
- Modify: `src/components/SignOutButton.tsx`
- Test: `src/lib/i18n-coverage.test.mjs`

- [ ] Add a static coverage test requiring all four selector options, complete `guide.en/ko/ja/es` sections, and no binary language branches in the listed public/menu files.
- [ ] Run the coverage test and confirm it fails on missing Japanese/Spanish content.
- [ ] Translate all public, authentication, navigation, version, and guidebook copy with four-locale records.
- [ ] Re-run the coverage test and confirm it passes.

### Task 3: Signed-in feature screens and workbench

**Files:**
- Modify: every non-admin `src/components/**` language consumer reported by `rg -l 'useLanguage|AppLanguage' src/components`
- Modify: `src/lib/workbench-model-guidance.ts`
- Modify: `src/lib/session-input-copy.ts`
- Test: `src/lib/i18n-coverage.test.mjs`

- [ ] Extend the coverage test to fail if any non-admin user-facing source retains a binary Korean/English language branch.
- [ ] Run it and confirm the expected failure count.
- [ ] Replace each branch with complete English, Korean, Japanese, and Spanish copy while preserving dynamic values and product terminology.
- [ ] Re-run focused tests and typecheck until clean.

### Task 4: Version, report, and complete verification

**Files:**
- Modify: `VERSION`
- Modify: `src/lib/version.ts`
- Create: `Report/Report_v1.36.0_20260630.md`

- [ ] Set the release version to `v1.36.0-20260630` and ensure the existing UI version surface reads it.
- [ ] Document changed files, localization coverage, verification evidence, and known unrelated dependency-audit findings.
- [ ] Run `npm test`, `npx tsc -p tsconfig.json --noEmit`, `npm run lint`, `npm run build`, and `git diff --check`.
- [ ] Start the app and verify Japanese and Spanish on landing, app navigation, and guidebook in a real browser.

### Task 5: Commit, push, deploy, and verify production

**Files:**
- Commit only files changed in this isolated worktree.

- [ ] Commit the specification/plan, localization implementation/tests, and release artifacts in scoped commits.
- [ ] Verify the final committed HEAD in the clean isolated worktree.
- [ ] Push `codex/ja-es-localization-20260630` to origin.
- [ ] Deploy with `vercel --prod --yes` using the linked qkiki project.
- [ ] Confirm `vercel inspect` reports Ready and `https://yapp.wideget.net` returns HTTP 200.
- [ ] Verify Japanese and Spanish selector options, localized navigation, guidebook copy, and `v1.36.0-20260630` on production.

