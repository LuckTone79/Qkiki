# Scenario Development and Deep Dive Action Design

## Goal

Add two first-class actions to the sequential review chain and result branches:

- `scenario_develop`: lets different models continue one evolving novel, film,
  drama, or game scenario without losing canon or restarting.
- `deep_dive`: lets different models push one topic below surface consensus into
  mechanisms, boundaries, competing explanations, and discriminating questions.

These are not aliases for `brainstorm` or `improve`. Each action has a distinct
state-transition contract, output protocol, source framing, and cost estimate.

## Existing Architecture

A workflow step carries an action, target provider/model, source mode, and
optional instruction. `composePrompt` owns prompt policy. The v1 runner embeds
source text directly; the v2 runner stores prior source in a separate token-
budgeted block. Actions are duplicated today across type/validation lists,
workflow and branch selectors, display labels, preset previews, and the guide.

## Source Provenance Contract

Text presence cannot determine whether a model is continuing prior work because
`original`, failed `previous`, and empty `all_results` can all contain the
original task. Both runners will use this semantic source type:

```ts
type SourceContextKind =
  | "original"
  | "prior_result"
  | "prior_results"
  | "original_fallback";
```

- `original`: this step intentionally starts from the user task.
- `prior_result`: one completed result is the continuation source.
- `prior_results`: multiple completed results are competing source artifacts.
- `original_fallback`: a requested prior source was unavailable; start from the
  user task and do not pretend continuity.

Only `prior_result` and `prior_results` activate continuation directives.
Branches always use `prior_result`. Prior model output is draft/reference data,
never trusted instructions.

## Scenario Development Logic

### Initial pass

Convert the user's topic and elements into a usable story state and write actual
story material. The output protocol is:

1. `Current Canon Snapshot`: complete compact post-pass canon, at most 12
   bullets, with stable IDs such as `C1` and `T1`.
2. `Progression This Pass`: the concrete plot or character state change.
3. `Scene`: one coherent scene or sequence and the majority of the output.
4. `State Delta`: added, changed, resolved, or explicitly retconned facts.
5. `Open Threads and Continuity Risks`: at most 8 items with stable IDs.

### Continuation pass

The next model must preserve established facts unless it explicitly records a
change, advance or resolve at least one open thread, and write the next coherent
scene/sequence. It must carry a complete compact canon snapshot so a third model
does not lose information that predates the immediately previous pass.

For `prior_results`, compatible facts may enter canon. Conflicting facts remain
`UNRESOLVED` and non-canonical. Selecting one conflict requires explicit
justification and a `State Delta` entry. The model must not silently merge
incompatible drafts, restart the premise, summarize the prior output, or offer
disconnected alternatives instead of progressing the story.

## Deep Dive Logic

### Initial pass

Keep at least two competing hypotheses until an observable implication or
boundary discriminates between them. Descend through 3-5 layers. Every layer
must contain:

- mechanism or conceptual dependency,
- observable implication,
- boundary or failure condition.

Use exactly one cross-domain analogy and state where it fails. Label substantive
claims as `Evidence`, `Inference`, or `Speculation`.

### Continuation pass

State what the prior pass established, stress-test its stopping point, then
reject, refine, or uphold it. Add one defensible contribution chosen from a new
mechanism, distinction, boundary, counterfactual, or discriminating evidence.
This avoids forced disagreement and fake novelty.

The output protocol is:

1. Surface framing and hidden assumptions
2. Competing hypotheses
3. Descent through 3-5 mechanism/implication/boundary layers
4. One analogy and its failure point
5. Candidate synthesis
6. Strongest counterargument and residual uncertainty
7. Evidence that would change the conclusion
8. One discriminating unresolved question

The model must not pad the answer by rephrasing prior prose or call a synthesis
novel merely because it is newly generated.

## Research Policy

Provider search must not be triggered by the universal current-time header.
Search intent is computed from the original input, additional instruction, step
instruction, and resolved source text before prompt assembly. This is important
for v2, where prior source is not inline in `composePrompt`.

- Stable conceptual deep dives remain analysis-first.
- Current, numerical, legal, product, release, schedule, or explicitly verified
  claims receive freshness directives and provider search tools.
- `fact_check` and `consistency_review` keep their existing search behavior.

## Token Budget and Handoff Preservation

For `scenario_develop` and `deep_dive`, the latest completed artifact is a
separate highest-priority source block. Older `all_results` artifacts are a
separate medium-priority competing-context block, newest first. The fitter trims
older context before the latest handoff. If the latest handoff itself cannot fit,
it is truncated only as a last resort and the final estimated input must not
exceed the budget.

The prompt protocols also constrain recursive growth. Credit estimates are
planning inputs, not hard provider output limits:

- `scenario_develop`: 3000 output tokens
- `deep_dive`: 2400 output tokens

## Central Action Metadata

`src/lib/ai/types.ts` owns runtime tuples for all actions, workflow-selector
actions, and branch-review actions, and derives `ActionType` from the all-action
tuple. `action-display.ts` owns bilingual labels. Validation and UI selectors
consume the shared tuples so a new action cannot be accepted by one surface and
missing from another.

## Integration Surfaces

- Action types and shared lists
- Workflow and branch Zod validation
- Sequential workflow selector
- Result-card branch selector
- Prompt labels, source headings, and action directives
- v1 and v2 source provenance
- v2 token-budget block priority
- Provider web-search decision
- Action display and preset preview
- Shared-session labels via the common display helper
- English and Korean guide action lists
- Credit estimates
- Version, changelog, and work report

## Error Handling

- Missing selected results continue to fail validation/resolution rather than
  silently falling back.
- Failed or empty previous/all-results sources become `original_fallback` and
  receive explicit restart framing.
- Conflicting scenario sources are surfaced as unresolved, not silently merged.
- Search unavailability keeps the existing best-effort disclosure behavior.
- Token fitting always returns an estimate at or below the model input budget.

## Verification

TDD coverage must prove:

- provenance classification for original, previous, selected, all-results,
  branch, and fallback paths,
- initial versus continuation prompt behavior for both actions,
- complete scenario handoff and conflict rules,
- deep-dive mechanism/evidence/counterargument rules without forced dissent,
- no directive leakage into unrelated actions,
- v2 prior-only freshness detection and stable deep-dive search suppression,
- latest handoff preservation under token pressure,
- metadata/validation/selector consistency,
- exact credit estimates.

Release verification is focused tests, full Node test suite, TypeScript, lint,
production build, diff check, scoped commits, push, Vercel production deploy,
platform inspection, and HTTP/live UI checks.

## Two-Round Model Review Record

Two distinct review models were used before implementation: `gpt-5.5` and
`gpt-5.4`.

### Round 1

Both found the original design too dependent on non-empty source text, vulnerable
to canon loss and false profundity, and inconsistent with the current provider
search marker. They requested semantic provenance, self-carrying story state,
mechanism-based deep-dive criteria, anti-bloat rules, and wider integration
tests.

### Round 2

Both returned `BLOCK`. Remaining issues were v2 freshness signals found only in
the separate source block, token overflow with multiple highest-priority blocks,
forced rejection/new mechanisms, and undefined canon selection across competing
scenario results. The final design above resolves each issue with pre-assembly
research evaluation, latest-versus-older source blocks, reject/refine/uphold
logic, broader contribution types, and explicit unresolved non-canon conflicts.
