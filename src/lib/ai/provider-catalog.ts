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
    defaultModel: "gpt-4o",
    models: [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4-turbo",
      "gpt-4",
      "gpt-3.5-turbo",
      "o1-preview",
      "o1-mini",
    ],
  },
  {
    name: "anthropic",
    displayName: "Claude / Anthropic",
    shortName: "Claude",
    envKey: "ANTHROPIC_API_KEY",
    defaultModel: "claude-3-5-sonnet-20241022",
    models: [
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20250219",
      "claude-3-sonnet-20240229",
      "claude-3-haiku-20240307",
    ],
  },
  {
    name: "google",
    displayName: "Gemini / Google",
    shortName: "Gemini",
    envKey: "GOOGLE_API_KEY",
    defaultModel: "gemini-2.0-flash",
    models: [
      "gemini-2.0-flash",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
      "gemini-1-pro",
    ],
  },
  {
    name: "xai",
    displayName: "Grok / xAI",
    shortName: "Grok",
    envKey: "XAI_API_KEY",
    defaultModel: "grok-3",
    models: ["grok-3", "grok-2", "grok-2-mini"],
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
