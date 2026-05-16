# Report v1.12.5-20260516

## Summary
- Investigated a sequential review chain failure that happened before the repeat block started and traced it to the Anthropic provider layer timing out at 60 seconds.
- Hardened provider timeout handling so slow reasoning models such as Claude Opus 4.7 are given a longer minimum timeout and a timed-out request can retry once.
- Exposed provider timeout seconds in the admin settings UI and API so operations can tune the limit without another code deploy.

## Root Cause
- Sequential repeat logic was not the failing layer in this incident.
- The run failed during step 2, before any repeat block execution, because the Anthropic provider request was aborted by a fixed timeout.
- The failure symptom matched the code path exactly:
  - `AdminProviderConfig.timeoutSeconds` defaulted to `60`
  - Anthropic provider catalog default also used a short timeout
  - `callProvider` aborted the fetch with `AbortController` when that timeout elapsed
  - The UI showed an Anthropic timeout failure at roughly 60002 ms

## Changes
- Raised the Anthropic provider default timeout baseline.
- Added model-aware minimum timeout enforcement:
  - Claude Opus 4.7: 180 seconds
  - Claude Sonnet 4.6: 120 seconds
  - Claude Haiku 4.5: 90 seconds
- Applied the effective timeout using the actual requested model at execution time instead of only the provider-level stored value.
- Added one automatic retry for timed-out Claude Opus 4.7 requests.
- Preserved explicit provider selection and existing no-fallback behavior for sequential workflow steps.
- Added `timeoutSeconds` to the admin provider API schema, response payload, and settings screen.
- Improved timeout error messaging so the saved result shows the actual timeout-based failure message instead of a generic placeholder.

## Verification
- `npm run lint` passed with one existing generated workflow route warning.
- `npm run build` passed with Next.js 16.2.3 and TypeScript checks.
