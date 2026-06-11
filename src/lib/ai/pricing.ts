import type { ProviderName } from "@/lib/ai/types";
import { MODEL_PRICING, estimateProviderCostUsd } from "@/lib/credits";

export { MODEL_PRICING, getModelPricing } from "@/lib/credits";

export function estimateCost(input: {
  provider: ProviderName;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
}) {
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
