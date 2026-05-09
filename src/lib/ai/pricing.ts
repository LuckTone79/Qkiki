import type { ProviderName } from "@/lib/ai/types";

type Pricing = {
  promptPerMillion: number;
  completionPerMillion: number;
};

const pricing: Record<string, Pricing> = {
  // OpenAI - GPT-5.4/5.5 family (2026 pricing)
  "openai:gpt-5.5": { promptPerMillion: 5, completionPerMillion: 30 },
  "openai:gpt-5.4": { promptPerMillion: 2.5, completionPerMillion: 15 },
  "openai:gpt-5.4-mini": { promptPerMillion: 0.75, completionPerMillion: 4.5 },
  "openai:gpt-5.4-nano": { promptPerMillion: 0.2, completionPerMillion: 1.25 },

  // Anthropic - Claude 4 family (2026 pricing)
  "anthropic:claude-opus-4-7": { promptPerMillion: 5, completionPerMillion: 25 },
  "anthropic:claude-sonnet-4-6": { promptPerMillion: 3, completionPerMillion: 15 },
  "anthropic:claude-haiku-4-5": { promptPerMillion: 1, completionPerMillion: 5 },

  // Google - Gemini family (2026 standard pricing)
  "google:gemini-3.1-pro-preview": {
    promptPerMillion: 2,
    completionPerMillion: 12,
  },
  "google:gemini-3-flash-preview": {
    promptPerMillion: 0.5,
    completionPerMillion: 3,
  },
  "google:gemini-2.5-pro": {
    promptPerMillion: 1.25,
    completionPerMillion: 10,
  },
  "google:gemini-2.5-flash": {
    promptPerMillion: 0.3,
    completionPerMillion: 2.5,
  },
  "google:gemini-2.5-flash-lite": {
    promptPerMillion: 0.1,
    completionPerMillion: 0.4,
  },

  // xAI - Grok family (2026 pricing)
  "xai:grok-4.3": { promptPerMillion: 1.25, completionPerMillion: 2.5 },
  "xai:grok-4.20-multi-agent": {
    promptPerMillion: 1.25,
    completionPerMillion: 2.5,
  },
  "xai:grok-4.20-reasoning": {
    promptPerMillion: 1.25,
    completionPerMillion: 2.5,
  },
  "xai:grok-4.20-non-reasoning": {
    promptPerMillion: 1.25,
    completionPerMillion: 2.5,
  },
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
