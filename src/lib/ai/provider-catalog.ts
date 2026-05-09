import type { ProviderName } from "@/lib/ai/types";

export type ProviderCatalogItem = {
  name: ProviderName;
  displayName: string;
  shortName: string;
  envKey: string;
  defaultModel: string;
  models: string[];
};

export const PROVIDERS: ProviderCatalogItem[] = [
  {
    name: "openai",
    displayName: "GPT / OpenAI",
    shortName: "GPT",
    envKey: "OPENAI_API_KEY",
    defaultModel: "gpt-5.5",
    models: [
      "gpt-5.5",
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.4-nano",
    ],
  },
  {
    name: "anthropic",
    displayName: "Claude / Anthropic",
    shortName: "Claude",
    envKey: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-4-6",
    models: [
      "claude-opus-4-7",
      "claude-sonnet-4-6",
      "claude-haiku-4-5",
    ],
  },
  {
    name: "google",
    displayName: "Gemini / Google",
    shortName: "Gemini",
    envKey: "GOOGLE_API_KEY",
    defaultModel: "gemini-3.1-pro-preview",
    models: [
      "gemini-3.1-pro-preview",
      "gemini-3-flash-preview",
      "gemini-3.1-flash-lite",
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
    ],
  },
  {
    name: "xai",
    displayName: "Grok / xAI",
    shortName: "Grok",
    envKey: "XAI_API_KEY",
    defaultModel: "grok-4.3",
    models: [
      "grok-4.3",
      "grok-4.20-multi-agent",
      "grok-4.20-reasoning",
      "grok-4.20-non-reasoning",
    ],
  },
];

export function getProviderCatalog(provider: ProviderName) {
  const item = PROVIDERS.find((entry) => entry.name === provider);

  if (!item) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  return item;
}

export function isProviderName(value: string): value is ProviderName {
  return PROVIDERS.some((entry) => entry.name === value);
}
