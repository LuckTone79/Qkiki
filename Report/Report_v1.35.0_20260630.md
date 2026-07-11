# Work Report

## Basic Info
- Version: `v1.35.0-20260630`
- Date: `2026-06-30`
- Previous Version: `v1.34.1-20260622`
- Project: `Yapp Multi AI`

## Summary
Added two dedicated multi-model workflow actions. Scenario development carries
story canon and open threads forward while writing actual new scenes. Deep dive
pushes prior analysis through competing hypotheses, causal mechanisms,
boundaries, counterarguments, and discriminating evidence instead of producing
longer summaries that merely sound profound.

## Design Review
Before production coding, the design received two feedback rounds from distinct
models: `gpt-5.5` and `gpt-5.4`. Round 1 identified weak continuation semantics,
canon loss, false profundity, and unconditional search activation. Round 2
blocked the revised design until v2 prior-source freshness, token overflow,
forced disagreement, and competing-canon rules were made explicit. The final
implementation incorporates those changes.

## Main Changes
- Added shared action metadata and bilingual labels for `scenario_develop` and
  `deep_dive` across workflow, branch, preset, shared-result, and guide surfaces.
- Added semantic source kinds: original, one prior result, multiple prior
  results, and original fallback.
- Added scenario canon snapshot, progression, scene, classified delta, open
  thread, retcon, and conflict rules.
- Added deep-dive hypothesis, mechanism, implication, boundary, analogy failure,
  claim-confidence, counterargument, uncertainty, and next-question rules.
- Updated v1/v2/branch execution paths and rejected unusable selected/branch
  sources instead of pretending they were valid continuations.
- Fixed provider search so the universal timestamp does not enable browsing,
  while current claims found only in v2 prior context still do.
- Made token fitting report and enforce the actual returned block budget.
- Set output estimates to 3000 tokens for scenario development and 2400 for
  deep dive.

## Verification
- Focused action/source/prompt/search/token/validation/credit tests
- `npm test`
- `npx tsc -p tsconfig.json --noEmit`
- `npm run lint`
- `npm run build`
- `git diff --check`
- Production deployment and live checks recorded in the release completion.

## Known Limits
- Prompt protocols strongly structure cross-model buildup, but model quality can
  still vary by provider and source material.
- The runtime does not execute arbitrary user code or use external story-state
  storage beyond the self-carrying result handoff.
