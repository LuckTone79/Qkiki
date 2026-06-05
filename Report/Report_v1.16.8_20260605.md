# Work Report

## Basic Info
- Version: `v1.16.8-20260605`
- Date: `2026-06-05`
- Previous version: `v1.16.7-20260605`
- Project: `Qkiki / Multi AI Workbench`

## Summary
- Rechecked OpenAI and Gemini model behavior against current official docs.
- Fixed OpenAI model guidance so `gpt-5.5` is classified as a top-tier/deep model instead of a balanced model.
- Updated the Gemini catalog to include the official Gemini 3 text preview models and kept the latest official Lite model available.

## Findings
- OpenAI official docs describe `gpt-5.5` as the newest frontier/default model for complex professional work, so showing only a balanced trait was misleading.
- Google official docs did not confirm exact model IDs `gemini-3.1-pro`, `gemini-3.5-flash`, or `gemini-3.1-flash-lite`.
- The official Gemini 3 text model IDs confirmed in Google docs are:
  - `gemini-3-pro-preview`
  - `gemini-3-flash-preview`
- The latest official Flash-Lite text model remains:
  - `gemini-2.5-flash-lite`

## Changes

### OpenAI guidance
- Removed `gpt-5.5` from the balanced-trait branch.
- Added `gpt-5.5` to the deep/top-tier trait branch.
- Added a regression test so `gpt-5.5` no longer appears as only balanced.

### Gemini model catalog
- Changed Gemini default model from `gemini-2.5-flash` to `gemini-3-flash-preview`.
- Added official Gemini 3 text preview models:
  - `gemini-3-flash-preview`
  - `gemini-3-pro-preview`
- Kept current official Gemini 2.5 models:
  - `gemini-2.5-flash-lite`
  - `gemini-2.5-flash`
  - `gemini-2.5-pro`
- Updated the default sequential workflow's Gemini step to `gemini-3-flash-preview`.

### Compatibility aliases
- Mapped user-facing or previously assumed Gemini IDs to official model IDs:
  - `gemini-3.1-pro-preview` -> `gemini-3-pro-preview`
  - `gemini-3.1-pro` -> `gemini-3-pro-preview`
  - `gemini-3.5-flash` -> `gemini-3-flash-preview`
  - `gemini-3.1-flash-lite` -> `gemini-2.5-flash-lite`

### Documentation and UI copy
- Updated supported model count from `14` to `16`.
- Updated README catalog summary from Gemini 2.5-only to Gemini 3/2.5.

## Main Files Changed
| File | Change | Notes |
|---|---|---|
| `src/lib/workbench-model-guidance.ts` | Modified | Classifies `gpt-5.5` as deep/top-tier |
| `src/lib/workbench-model-guidance.test.mjs` | Modified | Adds regression coverage for `gpt-5.5` |
| `src/lib/ai/provider-catalog.ts` | Modified | Adds Gemini 3 official preview models and aliases |
| `src/lib/ai/provider-catalog.test.mjs` | Modified | Locks the new Gemini catalog and alias behavior |
| `src/lib/ai/pricing.ts` | Modified | Adds Gemini 3 Preview pricing entries |
| `src/components/workbench/WorkbenchClient.tsx` | Modified | Updates default Gemini workflow step |
| `src/app/guide/page.tsx` | Modified | Updates supported model count |
| `README.md` | Modified | Updates provider catalog summary |
| `VERSION` | Modified | Bumped to `v1.16.8-20260605` |
| `src/lib/version.ts` | Modified | Bumped app-visible version |

## Verification
- `node --test src/lib/ai/provider-catalog.test.mjs src/lib/workbench-model-guidance.test.mjs src/lib/ai/summary-model.test.mjs`
- `npx tsc -p tsconfig.json --noEmit`
- `npm run lint`

## Official Sources Checked
- OpenAI GPT-5.5 model docs: `https://developers.openai.com/api/docs/models/gpt-5.5/`
- OpenAI models overview: `https://developers.openai.com/api/docs/models/overview`
- Google Gemini models: `https://ai.google.dev/models/gemini`
- Google Gemini 3 developer guide: `https://ai.google.dev/gemini-api/docs/gemini-3`
- Google Gemini pricing: `https://ai.google.dev/gemini-api/docs/pricing`

## Version History
| Version | Date | Summary |
|---|---|---|
| `v1.16.8-20260605` | 2026-06-05 | Fixed GPT-5.5 model guidance and updated Gemini catalog to official Gemini 3 Preview models |
| `v1.16.7-20260605` | 2026-06-05 | Preserved design refresh, confirmed model catalog state, and updated internal OpenAI summary path to `gpt-5.5` |
