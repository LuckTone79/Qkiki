import type { ProviderName } from "@/lib/ai/types";
import {
  MODEL_PRICING,
  estimateImageGenerationCostUsd,
  estimateProviderCostUsd,
} from "@/lib/credits";

export {
  IMAGE_GENERATION_PRICING,
  MODEL_PRICING,
  getImageGenerationPricing,
  getModelPricing,
} from "@/lib/credits";

export function estimateImageCost(input: {
  provider: ProviderName;
  model: string;
  imageCount?: number;
}) {
  return estimateImageGenerationCostUsd(input);
}

export function estimateCost(input: {
  provider: ProviderName;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  imageCount?: number;
}) {
  const imageCost = estimateImageGenerationCostUsd({
    provider: input.provider,
    model: input.model,
    imageCount: input.imageCount,
  });
  if (imageCost !== undefined) {
    return imageCost;
  }

  if (input.promptTokens == null || input.completionTokens == null) {
    return undefined;
  }

  if (!MODEL_PRICING[`${input.provider}:${input.model}`]) {
    return undefined;
  }

  return estimateProviderCostUsd({
    provider: input.provider,
    model: input.model,
    promptTokens: input.promptTokens,
    completionTokens: input.completionTokens,
  });
}
