# Model Catalog Expansion Report

Version: `v1.36.4-20260727`
Date: 2026-07-27

## Scope

Expanded the text-model picker to retain all provider models that the workbench can execute through its existing text-generation request contracts. The image-generation catalog remains separate because it uses per-image billing and a different execution path.

## Model Catalog

- OpenAI: GPT-5.6 Sol, Terra, Luna; GPT-5.5 and GPT-5.5 Pro; GPT-5.4, Mini, Nano, and Pro.
- Anthropic: Claude Haiku 4.5, Sonnet 5/4.6/4.5, Opus 5/4.8/4.7/4.6/4.5, and Fable 5.
- Google: Gemini 3.6 Flash, 3.5 Flash, 3.5 Flash-Lite, 3.1 Flash-Lite, 3.1 Pro Preview, 3 Flash Preview, 2.5 Flash-Lite (stable and Preview), 2.5 Flash, and 2.5 Pro.
- xAI: Grok 4.5.

## Billing And Compatibility

- Removed automatic upgrades for selectable GPT-5.5/GPT-5.4 and Gemini 3 Flash/Gemini 2.5 IDs, so a user-selected model is sent unchanged to the provider.
- Added each newly selectable model's published standard input/output token price to the shared credit estimator and actual-cost estimator.
- Updated timeouts, prompt budgets, picker labels, guidance traits, documentation, and the visible supported-model count to 30.

## Verification

- Focused catalog, guidance, and credit tests.
- TypeScript typecheck, lint, production build, and Vercel production smoke checks are run before release.

## Official Sources

- OpenAI model pricing: https://developers.openai.com/api/docs/pricing
- Anthropic model overview and pricing: https://platform.claude.com/docs/en/about-claude/models/overview and https://platform.claude.com/docs/en/about-claude/pricing
- Gemini models and pricing: https://ai.google.dev/gemini-api/docs/models and https://ai.google.dev/gemini-api/docs/pricing
- xAI models: https://docs.x.ai/developers/models
