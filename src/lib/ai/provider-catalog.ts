import type { ProviderName } from "@/lib/ai/types";

const OPENAI_LEGACY_MODEL_MAP: Record<string, string> = {
  "gpt-5.6": "gpt-5.6-sol",
  "gpt-5.5": "gpt-5.6-sol",
  "gpt-5.5-pro": "gpt-5.6-sol",
  "gpt-5.4": "gpt-5.6-terra",
  "gpt-5.4-pro": "gpt-5.6-sol",
  "gpt-5.4-mini": "gpt-5.6-luna",
  "gpt-5.4-nano": "gpt-5.6-luna",
};

const ANTHROPIC_LEGACY_MODEL_MAP: Record<string, string> = {
  "claude-fable-5": "claude-fable-5",
  "claude-opus-5": "claude-opus-5",
  "claude-sonnet-5": "claude-sonnet-5",
  "claude-opus-4-8": "claude-opus-5",
  "claude-opus-4-7": "claude-opus-5",
  "claude-opus-4-1-20250805": "claude-opus-5",
  "claude-sonnet-4-6": "claude-sonnet-5",
  "claude-sonnet-4-20250514": "claude-sonnet-5",
  "claude-haiku-4-5-20251001": "claude-haiku-4-5",
  "claude-3-5-haiku-20241022": "claude-haiku-4-5",
};

const GOOGLE_LEGACY_MODEL_MAP: Record<string, string> = {
  "gemini-3-pro-preview": "gemini-3.1-pro-preview",
  "gemini-3-pro": "gemini-3.1-pro-preview",
  "gemini-3.1-pro": "gemini-3.1-pro-preview",
  "gemini-3-flash-preview": "gemini-3.5-flash",
  "gemini-2.5-pro": "gemini-3.1-pro-preview",
  "gemini-2.5-flash": "gemini-3.6-flash",
  "gemini-2.5-flash-lite": "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite-preview-09-2025": "gemini-3.1-flash-lite",
};

const XAI_LEGACY_MODEL_MAP: Record<string, string> = {
  "grok-4.5-latest": "grok-4.5",
  "grok-build-latest": "grok-4.5",
  "grok-4.3": "grok-4.5",
  "grok-4.20-multi-agent": "grok-4.5",
  "grok-4.20-reasoning": "grok-4.5",
  "grok-4.20-non-reasoning": "grok-4.5",
  "grok-4.20-multi-agent-0309": "grok-4.5",
  "grok-4.20-0309-reasoning": "grok-4.5",
  "grok-4.20-0309-non-reasoning": "grok-4.5",
};

export type ProviderCatalogItem = {
  name: ProviderName;
  displayName: string;
  shortName: string;
  envKey: string;
  defaultModel: string;
  defaultTimeoutSeconds: number;
  models: string[];
  imageModels: string[];
};

export const PROVIDERS: ProviderCatalogItem[] = [
  {
    name: "openai",
    displayName: "GPT / OpenAI",
    shortName: "GPT",
    envKey: "OPENAI_API_KEY",
    defaultModel: "gpt-5.6-terra",
    defaultTimeoutSeconds: 120,
    models: [
      "gpt-5.6-luna",
      "gpt-5.6-terra",
      "gpt-5.6-sol",
    ],
    imageModels: [
      "gpt-image-2",
      "gpt-image-1",
    ],
  },
  {
    name: "anthropic",
    displayName: "Claude / Anthropic",
    shortName: "Claude",
    envKey: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-5",
    defaultTimeoutSeconds: 150,
    models: [
      "claude-haiku-4-5",
      "claude-sonnet-5",
      "claude-opus-5",
      "claude-fable-5",
    ],
    imageModels: [],
  },
  {
    name: "google",
    displayName: "Gemini / Google",
    shortName: "Gemini",
    envKey: "GOOGLE_API_KEY",
    defaultModel: "gemini-3.6-flash",
    defaultTimeoutSeconds: 90,
    models: [
      "gemini-3.1-flash-lite",
      "gemini-3.5-flash-lite",
      "gemini-3.5-flash",
      "gemini-3.6-flash",
      "gemini-3.1-pro-preview",
    ],
    imageModels: [
      "imagen-4.0-generate-001",
      "imagen-4.0-fast-generate-001",
      "imagen-4.0-ultra-generate-001",
      "gemini-2.5-flash-image",
      "gemini-3-pro-image",
    ],
  },
  {
    name: "xai",
    displayName: "Grok / xAI",
    shortName: "Grok",
    envKey: "XAI_API_KEY",
    defaultModel: "grok-4.5",
    defaultTimeoutSeconds: 90,
    models: [
      "grok-4.5",
    ],
    imageModels: [
      "grok-imagine-image-quality",
      "grok-imagine-image",
      "grok-2-image-1212",
    ],
  },
];

export function isImageModel(provider: ProviderName, model: string) {
  return Boolean(
    PROVIDERS.find((entry) => entry.name === provider)?.imageModels.includes(model),
  );
}

export function getImageModels(provider: ProviderName) {
  return getProviderCatalog(provider).imageModels;
}

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

export function normalizeProviderModel(
  provider: ProviderName,
  model: string,
) {
  if (provider === "openai") {
    return OPENAI_LEGACY_MODEL_MAP[model] ?? model;
  }

  if (provider === "anthropic") {
    return ANTHROPIC_LEGACY_MODEL_MAP[model] ?? model;
  }

  if (provider === "google") {
    return GOOGLE_LEGACY_MODEL_MAP[model] ?? model;
  }

  if (provider === "xai") {
    return XAI_LEGACY_MODEL_MAP[model] ?? model;
  }

  return model;
}

export function getDefaultTimeoutSeconds(provider: ProviderName) {
  return getProviderCatalog(provider).defaultTimeoutSeconds;
}

export function getMinimumTimeoutSecondsForModel(
  provider: ProviderName,
  model?: string | null,
) {
  const normalizedModel = normalizeProviderModel(provider, model?.trim() ?? "");

  if (provider === "openai") {
    if (normalizedModel === "gpt-5.6-sol") {
      return 180;
    }

    if (normalizedModel === "gpt-5.6-terra") {
      return 150;
    }

    if (normalizedModel === "gpt-5.6-luna") {
      return 90;
    }
  }

  if (provider === "anthropic") {
    if (normalizedModel === "claude-fable-5") {
      return 240;
    }

    if (normalizedModel === "claude-opus-5") {
      return 180;
    }

    if (normalizedModel === "claude-sonnet-5") {
      return 150;
    }

    if (normalizedModel === "claude-haiku-4-5") {
      return 90;
    }
  }

  if (provider === "xai" && normalizedModel === "grok-4.5") {
    return 90;
  }

  return getDefaultTimeoutSeconds(provider);
}

export function resolveProviderTimeoutSeconds(
  provider: ProviderName,
  configuredTimeoutSeconds?: number | null,
  model?: string | null,
) {
  const defaultTimeoutSeconds = getDefaultTimeoutSeconds(provider);
  const modelMinimumTimeoutSeconds = getMinimumTimeoutSecondsForModel(
    provider,
    model,
  );

  if (!configuredTimeoutSeconds || configuredTimeoutSeconds <= 0) {
    return Math.max(defaultTimeoutSeconds, modelMinimumTimeoutSeconds);
  }

  return Math.max(configuredTimeoutSeconds, modelMinimumTimeoutSeconds);
}
