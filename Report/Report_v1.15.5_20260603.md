# Work Report

## Basic Info
- **Version**: v1.15.5-20260603
- **Date**: 2026-06-03
- **Previous Version**: v1.15.4-20260603
- **Project**: Multi AI / Qkiki

## Summary
Improved the workbench UX around sequential runs and branch-heavy sessions. Result cards can now collapse to a first-line preview, the single-column layout is denser, the sequential progress panel can jump directly to produced results without resizing unpredictably on mobile, follow-up and review outputs are separated from the main workflow results, and latency/usage labels now match the actual units users care about.

## Changes
- Added a tested `src/lib/workbench-results.ts` helper layer for result depth, ordering, pinning, and main-vs-branch partitioning.
- Split the result board into `Main workflow results` and `Follow-up and branch results`.
- Added compact single-column cards with a collapse/expand toggle and first-line preview.
- Added per-step `Jump to result` actions in the sequential progress panel and capped the panel height to avoid live layout jitter.
- Changed visible latency text from milliseconds to seconds in workbench result cards.
- Reworked the follow-up/review composer so users pick a provider first and expand only the models they need.
- Replaced the usage card’s input-character box with remaining/used/daily-limit usage metrics.

## Changed Files
| Path | Change |
| --- | --- |
| `src/components/workbench/WorkbenchClient.tsx` | Split main vs branch result sections and added progress jump actions. |
| `src/components/workbench/ResultCard.tsx` | Added compact/collapsible cards, sec-based latency labels, and provider-first branch composer. |
| `src/components/billing/UsageStatus.tsx` | Replaced input-char summary with remaining/used/limit usage metrics. |
| `src/lib/workbench-results.ts` | Added reusable result ordering and grouping helpers. |
| `src/lib/workbench-results.test.mjs` | Added coverage for result helper behavior. |
| `VERSION` | Updated app version. |
| `src/lib/version.ts` | Updated displayed app version. |

## Verification
- `node --test src/lib/workbench-results.test.mjs` passed.
- `npx tsc -p tsconfig.json --noEmit` passed.
- `npm run lint` passed.
- `npm run build` passed.

## Remaining Risk
- The shared-session page still uses its own presentation layer, so the new main-vs-branch separation is currently strongest inside `/app/workbench`.
- The usage system itself is still request-based rather than token-metered, so the panel now reflects real app quota units instead of implying token accounting that does not yet exist.

## Version History
| Version | Date | Summary |
| --- | --- | --- |
| v1.15.5 | 2026-06-03 | Improved result-card density, branch separation, progress navigation, and usage display clarity. |
| v1.15.4 | 2026-06-03 | Hardened QStash base URL normalization and resumed post-upgrade queue testing. |
