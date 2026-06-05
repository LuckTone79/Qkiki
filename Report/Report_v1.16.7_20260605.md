# Work Report

## Basic Info
- Version: `v1.16.7-20260605`
- Date: `2026-06-05`
- Previous version: `v1.16.6-20260605`
- Project: `Qkiki / Multi AI Workbench`

## Summary
- Confirmed that the latest Claude-driven design update is still present in the working tree and was not reverted by the AI model catalog work.
- Re-checked the provider model catalog against current official docs from OpenAI, Anthropic, Google Gemini, and xAI on 2026-06-05.
- Found one remaining stale internal OpenAI path: the parallel comparison summary helper still used `gpt-5.4` directly. Updated that path to the current flagship target `gpt-5.5`.

## What Was Kept
- The current design refresh in `src/app/guide/page.tsx` remains intact.
- The already-applied provider catalog refresh also remains intact:
  - Anthropic `claude-opus-4-8`
  - Anthropic `claude-sonnet-4-6`
  - Anthropic `claude-haiku-4-5`
  - Gemini `gemini-2.5-pro`
  - Gemini `gemini-2.5-flash`
  - Gemini `gemini-2.5-flash-lite`
  - xAI `grok-4.3`
  - xAI `grok-4.20-*`
  - OpenAI `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano`

## Changes

### Internal model selection fix
- Added a dedicated helper for the parallel comparison summary model target.
- Switched the summary target from `gpt-5.4` to `gpt-5.5`.
- Wired `src/lib/ai/workflow.ts` to use the centralized helper instead of a stale hard-coded model string.

### Regression protection
- Added a focused test to lock the parallel comparison summary target to the current OpenAI flagship target.

## Main Files Changed
| File | Change | Notes |
|---|---|---|
| `src/lib/ai/summary-model.ts` | Added | Centralizes the parallel comparison summary target |
| `src/lib/ai/summary-model.test.mjs` | Added | Regression test for the summary target |
| `src/lib/ai/workflow.ts` | Modified | Uses centralized summary target instead of hard-coded `gpt-5.4` |
| `VERSION` | Modified | Version bumped to `v1.16.7-20260605` |
| `src/lib/version.ts` | Modified | App-visible version bumped |

## Verification
- `node --test src/lib/ai/summary-model.test.mjs`
- `node --test src/lib/ai/provider-catalog.test.mjs src/lib/workbench-model-guidance.test.mjs src/lib/workbench-result-board.test.mjs`
- `npx tsc -p tsconfig.json --noEmit`
- `npm run lint`

## Official Sources Checked
- OpenAI latest model guide: `https://developers.openai.com/api/docs/guides/latest-model`
- OpenAI model pages:
  - `https://developers.openai.com/api/docs/models/gpt-5.5`
  - `https://developers.openai.com/api/docs/models/gpt-5.4`
  - `https://developers.openai.com/api/docs/models/gpt-5.4-mini`
  - `https://developers.openai.com/api/docs/models/gpt-5.4-nano`
- Anthropic:
  - `https://www.anthropic.com/news/claude-opus-4-8`
  - `https://www.anthropic.com/claude/sonnet`
  - `https://www.anthropic.com/news/claude-haiku-4-5`
- Google Gemini:
  - `https://ai.google.dev/models/gemini`
- xAI:
  - `https://docs.x.ai/docs/models/`
  - `https://docs.x.ai/developers/models/grok-4.20`
  - `https://docs.x.ai/developers/models/grok-4.3`

## Version History
| Version | Date | Summary |
|---|---|---|
| `v1.16.7-20260605` | 2026-06-05 | Preserved design refresh, confirmed model catalog state, and updated the remaining internal OpenAI summary path to `gpt-5.5` |
| `v1.16.6-20260605` | 2026-06-05 | Latest design refresh from the prior update |
