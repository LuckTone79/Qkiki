import type { ProviderName } from "@/lib/ai/types";

export type ProviderCatalogItem = {
  name: ProviderName;
  displayName: string;
  shortName: string;
  envKey: string;
  defaultModel: string;
  defaultTimeoutSeconds: number;
  models: string[];
};

export const PROVIDERS: ProviderCatalogItem[] = [
  {
    name: "openai",
    displayName: "GPT / OpenAI",
    shortName: "GPT",
    envKey: "OPENAI_API_KEY",
    defaultModel: "gpt-5.5",
    defaultTimeoutSeconds: 300,
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
    defaultModel: "claude-sonnet-4-20250514",
    defaultTimeoutSeconds: 90,
    models: [
      "claude-opus-4-1-20250805",
      "claude-sonnet-4-20250514",
      "claude-3-5-haiku-20241022",
    ],
  },
  {
    name: "google",
    displayName: "Gemini / Google",
    shortName: "Gemini",
    envKey: "GOOGLE_API_KEY",
    defaultModel: "gemini-3.1-pro-preview",
    defaultTimeoutSeconds: 90,
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
    defaultTimeoutSeconds: 90,
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

export function getDefaultTimeoutSeconds(provider: ProviderName) {
  return getProviderCatalog(provider).defaultTimeoutSeconds;
}

export function resolveProviderTimeoutSeconds(
  provider: ProviderName,
  configuredTimeoutSeconds?: number | null,
) {
  const defaultTimeoutSeconds = getDefaultTimeoutSeconds(provider);

  if (!configuredTimeoutSeconds || configuredTimeoutSeconds <= 0) {
    return defaultTimeoutSeconds;
  }

  // OpenAI used a legacy global default of 60 seconds. Preserve explicit custom
  // values while automatically upgrading that legacy default to the safer,
  // provider-specific timeout for reasoning-heavy GPT-5 responses.
  if (provider === "openai" && configuredTimeoutSeconds === 60) {
    return defaultTimeoutSeconds;
  }

  return configuredTimeoutSeconds;
}
