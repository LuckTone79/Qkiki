# Yapp Redesign Restore Merge Report

Version: `v1.38.1-20260728`
Date: 2026-07-28

## Scope

Merged the v1.38 Yapp redesign back onto the current production branch that had already shipped the v1.36.4 model catalog refresh.

## Changes

- Restored v1.38 UI surfaces for the app shell, auth screens, workbench, result cards, provider selection, mobile navigation, and brand icon assets.
- Preserved the current production Supabase/Auth runtime, canonical Yapp host compatibility, local cache/cookie migration behavior, and admin runtime paths.
- Preserved the refreshed 30-model text catalog, credit pricing, provider display names, and guide model count.
- Updated default sequential-chain models to `gpt-5.6-terra`, `grok-4.5`, and `gemini-3.6-flash`.
- Bumped visible app version files to `v1.38.1-20260728`.

## Verification Results

- Passed: focused provider catalog, credits, auth handoff, canonical-host, browser storage, and workbench tests.
- Passed: `npx tsc -p tsconfig.json --noEmit`.
- Passed: `npm run lint`.
- Passed: `git diff --check`.
- Passed: `npm run build`.
- Passed: local Playwright smoke for desktop and mobile landing pages, plus guide version/model-count checks.
- Pending: Vercel production deployment and live checks on `https://yapp.wideget.net`.
