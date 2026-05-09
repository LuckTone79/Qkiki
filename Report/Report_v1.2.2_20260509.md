# QKIKI Workbench v1.2.2 Report

- Date: 2026-05-09
- Version: `v1.2.2-20260509`
- Previous Version: `v1.2.1-20260509`

## Summary

- Refreshed the provider model catalog to current official API model IDs for OpenAI, Anthropic, Google Gemini, and xAI Grok.
- Updated the default workbench route to start from the latest OpenAI and xAI flagship models.
- Refreshed pricing estimates for the newly mapped models where current official token pricing was available.
- Added step normalization so older presets and saved sessions fall back to each provider's current default model if a retired model ID is encountered.

## Official Sources Checked

- OpenAI Models docs: `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano`
- Anthropic Claude models overview: `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5`
- Google Gemini models docs: `gemini-3.1-pro-preview`, `gemini-3-flash-preview`, `gemini-3.1-flash-lite`, `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`
- xAI models and migration docs: `grok-4.3`, `grok-4.20-multi-agent`, `grok-4.20-reasoning`, `grok-4.20-non-reasoning`

## Files Changed

- `src/lib/ai/provider-catalog.ts`
- `src/lib/ai/pricing.ts`
- `src/components/workbench/WorkbenchClient.tsx`
- `README.md`
- `VERSION`
- `src/lib/version.ts`

## Notes

- Google Gemini `gemini-3.1-flash-lite` was updated to the current stable model ID from the models docs. Its estimate is intentionally left unmapped until the pricing page exposes a matching stable SKU explicitly.
- Existing saved presets or sessions that reference removed model IDs are now normalized to the provider default when loaded into the workbench UI.
