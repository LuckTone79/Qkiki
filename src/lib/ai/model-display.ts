import type { ProviderName } from "@/lib/ai/types";
import { normalizeProviderModel } from "@/lib/ai/provider-catalog";

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "anthropic:claude-opus-4-8": "Opus 4.8",
  "anthropic:claude-sonnet-4-6": "Sonnet 4.6",
  "anthropic:claude-haiku-4-5": "Haiku 4.5",
  "openai:gpt-image-1": "GPT Image 1",
  "openai:gpt-image-2": "GPT Image 2",
  "google:imagen-4.0-generate-001": "Imagen 4",
  "xai:grok-2-image-1212": "Grok Image",
};

export function getModelDisplayName(
  provider: ProviderName,
  model: string,
) {
  const normalizedModel = normalizeProviderModel(provider, model);
  return MODEL_DISPLAY_NAMES[`${provider}:${normalizedModel}`] ?? normalizedModel;
}

export function getModelOptionLabel(
  provider: ProviderName,
  model: string,
) {
  const normalizedModel = normalizeProviderModel(provider, model);
  const displayName = getModelDisplayName(provider, normalizedModel);

  return displayName === normalizedModel
    ? displayName
    : `${displayName} (${normalizedModel})`;
}
