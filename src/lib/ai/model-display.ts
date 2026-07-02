import type { ProviderName } from "@/lib/ai/types";
import { normalizeProviderModel } from "@/lib/ai/provider-catalog";

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "anthropic:claude-opus-4-8": "Opus 4.8",
  "anthropic:claude-sonnet-5": "Sonnet 5",
  "anthropic:claude-sonnet-4-6": "Sonnet 4.6",
  "anthropic:claude-haiku-4-5": "Haiku 4.5",
  "google:gemini-3.5-flash": "Gemini 3.5 Flash",
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

/**
 * Brand-colored badge classes per AI provider, so each model reads at a glance.
 * Colors follow each company's brand identity:
 *  - anthropic → Claude logo coral (#D97757)
 *  - openai    → OpenAI green (#10A37F)
 *  - google    → Google / Gemini blue (#4285F4)
 *  - xai       → Grok / xAI black (#1A1A1A)
 * Literal class strings below are kept intact so Tailwind's JIT picks them up.
 */
export function getProviderBrandBadgeClass(provider: ProviderName): string {
  switch (provider) {
    case "anthropic":
      return "bg-[#D97757] text-white";
    case "openai":
      return "bg-[#10A37F] text-white";
    case "google":
      return "bg-[#4285F4] text-white";
    case "xai":
      return "bg-[#1A1A1A] text-white";
    default:
      return "bg-stone-700 text-white";
  }
}
