import type { ProviderName } from "./types";
import {
  estimateImageGenerationCostUsd,
  estimateProviderCostUsd,
  getImageGenerationPricing,
  getModelPricing,
} from "../credits";

export {
  IMAGE_GENERATION_PRICING,
  MODEL_PRICING,
  getImageGenerationPricing,
  getModelPricing,
} from "../credits";

export function estimateImageCost(input: {
  provider: ProviderName;
  model: string;
  imageCount?: number;
}) {
  return estimateImageGenerationCostUsd(input);
}

export function requireRegisteredProviderPricing(input: {
  provider: ProviderName;
  model: string;
}) {
  if (
    getImageGenerationPricing(input.provider, input.model) ||
    getModelPricing(input.provider, input.model)
  ) {
    return;
  }

  throw new Error(
    `Pricing is not registered for ${input.provider}/${input.model}.`,
  );
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

  requireRegisteredProviderPricing(input);

  if (input.promptTokens == null || input.completionTokens == null) {
    return undefined;
  }

  return estimateProviderCostUsd({
    provider: input.provider,
    model: input.model,
    promptTokens: input.promptTokens,
    completionTokens: input.completionTokens,
  });
}
