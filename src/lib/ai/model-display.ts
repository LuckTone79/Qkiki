import type { ProviderName } from "@/lib/ai/types";
import { normalizeProviderModel } from "@/lib/ai/provider-catalog";

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "openai:gpt-5.6-sol": "GPT-5.6 Sol",
  "openai:gpt-5.6-terra": "GPT-5.6 Terra",
  "openai:gpt-5.6-luna": "GPT-5.6 Luna",
  "anthropic:claude-fable-5": "Fable 5",
  "anthropic:claude-opus-5": "Opus 5",
  "anthropic:claude-sonnet-5": "Sonnet 5",
  "anthropic:claude-haiku-4-5": "Haiku 4.5",
  "google:gemini-3.6-flash": "Gemini 3.6 Flash",
  "google:gemini-3.5-flash": "Gemini 3.5 Flash",
  "google:gemini-3.5-flash-lite": "Gemini 3.5 Flash-Lite",
  "google:gemini-3.1-flash-lite": "Gemini 3.1 Flash-Lite",
  "google:gemini-3.1-pro-preview": "Gemini 3.1 Pro Preview",
  "xai:grok-4.5": "Grok 4.5",
  // Image-generation models
  "openai:gpt-image-1": "GPT Image 1",
  "openai:gpt-image-2": "GPT Image 2",
  "google:imagen-4.0-generate-001": "Imagen 4",
  "google:imagen-4.0-fast-generate-001": "Imagen 4 Fast",
  "google:imagen-4.0-ultra-generate-001": "Imagen 4 Ultra",
  "google:gemini-2.5-flash-image": "Gemini 2.5 Flash Image",
  "google:gemini-3-pro-image": "Gemini 3 Pro Image",
  "xai:grok-2-image-1212": "Grok 2 Image",
  "xai:grok-imagine-image": "Grok Imagine",
  "xai:grok-imagine-image-quality": "Grok Imagine (Quality)",
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
