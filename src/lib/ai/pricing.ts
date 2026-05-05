import type { ProviderName } from "@/lib/ai/types";

type Pricing = {
  promptPerMillion: number;
  completionPerMillion: number;
};

const pricing: Record<string, Pricing> = {
  // OpenAI - GPT-4o family (2025 pricing)
  "openai:gpt-4o": { promptPerMillion: 5, completionPerMillion: 15 },
  "openai:gpt-4o-mini": { promptPerMillion: 0.15, completionPerMillion: 0.6 },
  "openai:gpt-4-turbo": { promptPerMillion: 10, completionPerMillion: 30 },
  "openai:gpt-4": { promptPerMillion: 30, completionPerMillion: 60 },
  "openai:gpt-3.5-turbo": { promptPerMillion: 0.5, completionPerMillion: 1.5 },
  "openai:o1-preview": { promptPerMillion: 15, completionPerMillion: 60 },
  "openai:o1-mini": { promptPerMillion: 3, completionPerMillion: 12 },

  // Anthropic - Claude family (2025 pricing)
  "anthropic:claude-3-5-sonnet-20241022": {
    promptPerMillion: 3,
    completionPerMillion: 15,
  },
  "anthropic:claude-3-5-haiku-20241022": {
    promptPerMillion: 0.8,
    completionPerMillion: 4,
  },
  "anthropic:claude-3-opus-20250219": {
    promptPerMillion: 15,
    completionPerMillion: 75,
  },
  "anthropic:claude-3-sonnet-20240229": {
    promptPerMillion: 3,
    completionPerMillion: 15,
  },
  "anthropic:claude-3-haiku-20240307": {
    promptPerMillion: 0.8,
    completionPerMillion: 4,
  },

  // Google - Gemini family (2025 pricing)
  "google:gemini-2.0-flash": { promptPerMillion: 0.075, completionPerMillion: 0.3 },
  "google:gemini-1.5-pro": { promptPerMillion: 7.5, completionPerMillion: 30 },
  "google:gemini-1.5-flash": { promptPerMillion: 0.075, completionPerMillion: 0.3 },
  "google:gemini-1-pro": { promptPerMillion: 0.5, completionPerMillion: 1.5 },

  // xAI - Grok family (2025 pricing)
  "xai:grok-3": { promptPerMillion: 5, completionPerMillion: 15 },
  "xai:grok-2": { promptPerMillion: 3, completionPerMillion: 10 },
  "xai:grok-2-mini": { promptPerMillion: 0.15, completionPerMillion: 0.6 },
};

export function estimateCost(input: {
  provider: ProviderName;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
}) {
  const modelPricing = pricing[`${input.provider}:${input.model}`];

  if (!modelPricing || !input.promptTokens || !input.completionTokens) {
    return undefined;
  }

  return (
    (input.promptTokens / 1_000_000) * modelPricing.promptPerMillion +
    (input.completionTokens / 1_000_000) * modelPricing.completionPerMillion
  );
}
