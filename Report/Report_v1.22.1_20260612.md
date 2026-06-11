# Work Report

## Basic Info
- **Version**: v1.22.1-20260612
- **Date**: 2026-06-12
- **Previous version**: v1.22.0-20260611
- **Project**: Qkiki Multi AI Workbench

## Summary
This patch improves sequential workflow behavior for current factual tasks. Model prompts now include run-time context, strongly prefer web/search grounding for fresh facts, and require fact-check steps to add the model's own independent assessment instead of only reviewing prior outputs.

## Changes
### Added
- Current UTC and Asia/Seoul timestamp context in every composed workbench prompt.
- Freshness/web-research directives for current, recent, scheduled, numerical, sports, pricing, ranking, release, and other time-sensitive questions.
- Provider web-search tool configuration helper covering OpenAI, Anthropic, Google Gemini, and xAI.
- Regression coverage for prompt freshness rules and provider web-search configuration.

### Modified
- Fact-check action guidance now asks for source-grounded factual accuracy, missing context, and the model's own assessment.
- Standard result execution and queued sequential execution now pass `enableWebSearch` into provider calls when the prompt requires fresh verification.
- xAI uses the Responses API path when web search is enabled and no image attachments are present.

### Removed
- The old fact-check instruction that told models not to claim live web verification, which conflicted with provider search tools.

## Main Files
| File | Type | Description |
| --- | --- | --- |
| `src/lib/ai/prompt.ts` | Modified | Adds current-time context, freshness policy, and fact-check opinion requirements. |
| `src/lib/ai/provider-web-search.ts` | Added | Centralizes provider search policy and API tool shapes. |
| `src/lib/ai/providers.ts` | Modified | Adds provider web-search/grounding tools to outgoing requests. |
| `src/lib/ai/workflow.ts` | Modified | Enables search-aware provider calls for persisted workbench results. |
| `src/lib/execution-run-steps.ts` | Modified | Enables the same search policy in queued sequential runner steps. |
| `src/lib/ai/prompt.test.mjs` | Modified | Adds prompt-level regression tests. |
| `src/lib/ai/provider-web-search.test.mjs` | Added | Adds provider tool configuration tests. |
| `VERSION` | Modified | Bumped to v1.22.1-20260612. |
| `src/lib/version.ts` | Modified | Updates visible app version. |

## Verification
- `node --test src/lib/ai/prompt.test.mjs src/lib/ai/provider-web-search.test.mjs`
- `npx tsc -p tsconfig.json --noEmit`
- `node --test src/lib/ai/*.test.mjs src/lib/workbench-run-payload.test.mjs src/lib/workbench-sharing.test.mjs`

## Notes
- `QKIKI_WEB_SEARCH_ENABLED=false` can disable provider web-search tool use if an operator needs a cost or compatibility fallback.
- Full lint/build verification is expected after this report update.
