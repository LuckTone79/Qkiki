# Work Report

## Basic Info
- Version: `v1.15.8-20260604`
- Date: `2026-06-04`
- Previous version: `v1.15.7-20260604`
- Project: `Qkiki / Multi AI Workbench`

## Summary
- Verified the current provider model catalog against official model documentation from OpenAI, Anthropic, Google Gemini, and xAI on 2026-06-04.
- Updated stale Anthropic and Gemini model entries in the app so the selectable catalog matches current supported model tiers for this codebase.
- Added automatic normalization so older saved model aliases are upgraded to current supported models instead of silently failing or falling back incorrectly.

## Changes

### Updated model catalog
- Anthropic Opus entry updated from `claude-opus-4-7` to `claude-opus-4-8`.
- Gemini preview-era catalog entries removed from the selectable list:
  - `gemini-3.1-pro-preview`
  - `gemini-3-flash-preview`
  - `gemini-3.1-flash-lite`
- Gemini selectable catalog aligned to current text-generation models used by this app:
  - `gemini-2.5-pro`
  - `gemini-2.5-flash`
  - `gemini-2.5-flash-lite`

### Backward compatibility
- Added legacy model normalization for Anthropic:
  - `claude-opus-4-7` -> `claude-opus-4-8`
  - `claude-opus-4-1-20250805` -> `claude-opus-4-8`
  - `claude-haiku-4-5-20251001` -> `claude-haiku-4-5`
- Added legacy model normalization for Google Gemini:
  - `gemini-3.1-pro-preview` -> `gemini-2.5-pro`
  - `gemini-3-flash-preview` -> `gemini-2.5-flash`
  - `gemini-3.1-flash-lite` -> `gemini-2.5-flash-lite`
- Applied normalization in provider execution and workbench step restoration so existing sessions upgrade cleanly.

### UI and docs alignment
- Updated Anthropic display label from `Opus 4.7` to `Opus 4.8`.
- Updated the guide page supported-model count from `17` to `14`.
- Updated the README provider catalog summary to match the current catalog.

## Main Files Changed
| File | Change | Notes |
|---|---|---|
| `src/lib/ai/provider-catalog.ts` | Modified | Updated provider model lists and legacy model normalization |
| `src/lib/ai/providers.ts` | Modified | Normalize incoming provider models before execution |
| `src/components/workbench/WorkbenchClient.tsx` | Modified | Normalize stale saved step and selection models in the UI |
| `src/lib/ai/pricing.ts` | Modified | Renamed Anthropic Opus pricing key to the new model id |
| `src/lib/ai/model-display.ts` | Modified | Updated Anthropic Opus display name |
| `src/lib/ai/provider-catalog.test.mjs` | Added | Regression tests for current catalog and legacy model upgrades |
| `src/app/guide/page.tsx` | Modified | Updated supported model count copy |
| `README.md` | Modified | Updated provider catalog description |
| `VERSION` | Modified | Bumped project version |
| `src/lib/version.ts` | Modified | Bumped app-visible version |

## Verification
- `node --test src/lib/ai/provider-catalog.test.mjs src/lib/workbench-model-guidance.test.mjs src/lib/workbench-result-board.test.mjs`
- `npx tsc -p tsconfig.json --noEmit`
- `npm run lint`

## Official sources checked
- OpenAI Models: `https://platform.openai.com/docs/models`
- Anthropic Claude models and pricing:
  - `https://www.anthropic.com/news/claude-opus-4-8`
  - `https://www.anthropic.com/claude/opus`
  - `https://docs.anthropic.com/en/docs/about-claude/models/overview`
- Google Gemini models:
  - `https://ai.google.dev/gemini-api/docs/models/gemini`
  - `https://ai.google.dev/gemini-api/docs/models/gemini-v2`
- xAI models:
  - `https://docs.x.ai/docs/models/`
  - `https://docs.x.ai/docs/models/chat-models/grok-4-20`

## Follow-up
- If you want the default first-step OpenAI model switched from `gpt-5.4-mini` to the flagship `gpt-5.5`, that is a separate product choice. I did not change it here because `gpt-5.4-mini` is still a current supported tier, not a stale model id.

## Version History
| Version | Date | Summary |
|---|---|---|
| `v1.15.8-20260604` | 2026-06-04 | Refreshed Anthropic/Gemini model catalog to current supported versions and added legacy alias upgrades |
| `v1.15.7-20260604` | 2026-06-04 | Top 10 UX improvement pass and review follow-up adjustments |
