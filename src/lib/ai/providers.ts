import "server-only";

import { decryptSecret } from "@/lib/secret-crypto";
import { prisma } from "@/lib/prisma";
import { getProviderCatalog } from "@/lib/ai/provider-catalog";
import { estimateCost } from "@/lib/ai/pricing";
import type {
  ProviderAttachmentInput,
  ProviderCallInput,
  ProviderCallResult,
  ProviderName,
  UsageInfo,
} from "@/lib/ai/types";

type JsonRecord = Record<string, unknown>;

async function readJson(response: Response) {
  try {
    return (await response.json()) as JsonRecord;
  } catch {
    return {};
  }
}

function getText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeUsage(input: {
  promptTokens?: unknown;
  completionTokens?: unknown;
  totalTokens?: unknown;
}): UsageInfo {
  const promptTokens =
    typeof input.promptTokens === "number" ? input.promptTokens : undefined;
  const completionTokens =
    typeof input.completionTokens === "number"
      ? input.completionTokens
      : undefined;
  const totalTokens =
    typeof input.totalTokens === "number" ? input.totalTokens : undefined;

  return { promptTokens, completionTokens, totalTokens };
}

function withCost(
  result: Omit<ProviderCallResult, "estimatedCost" | "costIsEstimated">,
) {
  const estimatedCost = estimateCost({
    provider: result.provider,
    model: result.model,
    promptTokens: result.usage?.promptTokens,
    completionTokens: result.usage?.completionTokens,
  });

  return {
    ...result,
    estimatedCost,
    costIsEstimated: estimatedCost !== undefined,
  };
}

function providerError(provider: ProviderName, body: JsonRecord) {
  const error = body.error;

  if (typeof error === "string") {
    return `${provider}: ${error}`;
  }

  if (error && typeof error === "object" && "message" in error) {
    return `${provider}: ${String((error as { message: unknown }).message)}`;
  }

  if ("message" in body) {
    return `${provider}: ${String(body.message)}`;
  }

  return `${provider}: provider request failed`;
}

function buildPromptText(
  prompt: string,
  attachments?: ProviderAttachmentInput[],
) {
  const textParts = (attachments || [])
    .filter((attachment) => attachment.extractedText?.trim())
    .map((attachment, index) =>
      [
        `[Attached file ${index + 1}] ${attachment.name}`,
        `Type: ${attachment.mimeType}`,
        attachment.extractedText?.trim() || "",
      ].join("\n"),
    );

  if (!textParts.length) {
    return prompt;
  }

  return [prompt, "Attached file context:", ...textParts].join("\n\n");
}

function getImageAttachments(attachments?: ProviderAttachmentInput[]) {
  return (attachments || []).filter(
    (attachment) => attachment.kind === "IMAGE" && attachment.dataBase64,
  );
}

function buildOpenAiInput(input: ProviderCallInput) {
  const content: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text: buildPromptText(input.prompt, input.attachments),
    },
  ];

  getImageAttachments(input.attachments).forEach((attachment) => {
    content.push({
      type: "input_image",
      image_url: `data:${attachment.mimeType};base64,${attachment.dataBase64}`,
      detail: "high",
    });
  });

  return [{ role: "user", content }];
}

function buildAnthropicContent(input: ProviderCallInput) {
  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: buildPromptText(input.prompt, input.attachments),
    },
  ];

  getImageAttachments(input.attachments).forEach((attachment) => {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: attachment.mimeType,
        data: attachment.dataBase64,
      },
    });
  });

  return content;
}

function buildGoogleParts(input: ProviderCallInput) {
  const parts: Array<Record<string, unknown>> = [
    {
      text: buildPromptText(input.prompt, input.attachments),
    },
  ];

  getImageAttachments(input.attachments).forEach((attachment) => {
    parts.push({
      inline_data: {
        mime_type: attachment.mimeType,
        data: attachment.dataBase64,
      },
    });
  });

  return parts;
}

function buildXaiInput(input: ProviderCallInput) {
  const content: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text: buildPromptText(input.prompt, input.attachments),
    },
  ];

  getImageAttachments(input.attachments).forEach((attachment) => {
    content.push({
      type: "input_image",
      image_url: `data:${attachment.mimeType};base64,${attachment.dataBase64}`,
      detail: "high",
    });
  });

  return [{ role: "user", content }];
}

async function getProviderRuntimeConfig(provider: ProviderName) {
  const catalog = getProviderCatalog(provider);
  const envValue = process.env[catalog.envKey];
  const config = await prisma.adminProviderConfig.findUnique({
    where: { providerName: provider },
  });

  if (envValue?.trim()) {
    return {
      apiKey: envValue.trim(),
      timeoutSeconds: config?.timeoutSeconds ?? 60,
    };
  }

  if (
    config?.apiKeyCiphertext &&
    config.apiKeyIv &&
    config.apiKeyTag
  ) {
    return {
      apiKey: decryptSecret({
        ciphertext: config.apiKeyCiphertext,
        iv: config.apiKeyIv,
        tag: config.apiKeyTag,
      }),
      timeoutSeconds: config.timeoutSeconds,
    };
  }

  return {
    apiKey: null,
    timeoutSeconds: config?.timeoutSeconds ?? 60,
  };
}

export async function getApiKeyForProvider(provider: ProviderName) {
  const runtime = await getProviderRuntimeConfig(provider);
  return runtime.apiKey;
}

export async function callProvider(
  _userId: string,
  input: ProviderCallInput,
): Promise<ProviderCallResult> {
  const runtime = await getProviderRuntimeConfig(input.provider);
  const apiKey = runtime.apiKey;
  const startedAt = Date.now();

  if (!apiKey) {
    return {
      provider: input.provider,
      model: input.model,
      outputText: "",
      rawResponse: null,
      latencyMs: 0,
      status: "failed",
      errorMessage: "API key is not configured for this provider.",
    };
  }

  try {
    const signal = AbortSignal.timeout(runtime.timeoutSeconds * 1000);

    if (input.provider === "openai") {
      return await callOpenAi(apiKey, input, startedAt, signal);
    }

    if (input.provider === "anthropic") {
      return await callAnthropic(apiKey, input, startedAt, signal);
    }

    if (input.provider === "google") {
      return await callGoogle(apiKey, input, startedAt, signal);
    }

    return await callXai(apiKey, input, startedAt, signal);
  } catch (error) {
    return {
      provider: input.provider,
      model: input.model,
      outputText: "",
      rawResponse: null,
      latencyMs: Date.now() - startedAt,
      status: "failed",
      errorMessage:
        error instanceof Error ? error.message : "Provider request failed.",
    };
  }
}

async function callOpenAi(
  apiKey: string,
  input: ProviderCallInput,
  startedAt: number,
  signal: AbortSignal,
) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      messages: buildOpenAiInput(input),
      temperature: 0.4,
    }),
  });
  const body = await readJson(response);

  if (!response.ok) {
    throw new Error(providerError("openai", body));
  }

  const choices = Array.isArray(body.choices) ? body.choices : [];
  const firstChoice = choices[0] as JsonRecord | undefined;
  const message = firstChoice?.message as JsonRecord | undefined;
  const outputText = getText(message?.content) || "";
  const usageBody = body.usage as JsonRecord | undefined;

  return withCost({
    provider: "openai",
    model: input.model,
    outputText,
    rawResponse: body,
    usage: normalizeUsage({
      promptTokens: usageBody?.prompt_tokens,
      completionTokens: usageBody?.completion_tokens,
      totalTokens: usageBody?.total_tokens,
    }),
    latencyMs: Date.now() - startedAt,
    status: "completed",
  });
}

async function callAnthropic(
  apiKey: string,
  input: ProviderCallInput,
  startedAt: number,
  signal: AbortSignal,
) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2024-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: 2048,
      messages: [{ role: "user", content: buildAnthropicContent(input) }],
      temperature: 0.4,
    }),
  });
  const body = await readJson(response);

  if (!response.ok) {
    throw new Error(providerError("anthropic", body));
  }

  const content = Array.isArray(body.content) ? body.content : [];
  const text = content
    .map((entry) =>
      entry && typeof entry === "object" && "text" in entry
        ? String((entry as { text: unknown }).text)
        : "",
    )
    .join("\n")
    .trim();
  const usageBody = body.usage as JsonRecord | undefined;

  return withCost({
    provider: "anthropic",
    model: input.model,
    outputText: text,
    rawResponse: body,
    usage: normalizeUsage({
      promptTokens: usageBody?.input_tokens,
      completionTokens: usageBody?.output_tokens,
    }),
    latencyMs: Date.now() - startedAt,
    status: "completed",
  });
}

async function callGoogle(
  apiKey: string,
  input: ProviderCallInput,
  startedAt: number,
  signal: AbortSignal,
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    input.model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: buildGoogleParts(input) }],
      generationConfig: { temperature: 0.4 },
    }),
  });
  const body = await readJson(response);

  if (!response.ok) {
    throw new Error(providerError("google", body));
  }

  const candidates = Array.isArray(body.candidates) ? body.candidates : [];
  const first = candidates[0] as JsonRecord | undefined;
  const content = first?.content as JsonRecord | undefined;
  const parts = Array.isArray(content?.parts) ? content.parts : [];
  const text = parts
    .map((part) =>
      part && typeof part === "object" && "text" in part
        ? String((part as { text: unknown }).text)
        : "",
    )
    .join("\n")
    .trim();
  const usageBody = body.usageMetadata as JsonRecord | undefined;

  return withCost({
    provider: "google",
    model: input.model,
    outputText: text,
    rawResponse: body,
    usage: normalizeUsage({
      promptTokens: usageBody?.promptTokenCount,
      completionTokens: usageBody?.candidatesTokenCount,
      totalTokens: usageBody?.totalTokenCount,
    }),
    latencyMs: Date.now() - startedAt,
    status: "completed",
  });
}

async function callXai(
  apiKey: string,
  input: ProviderCallInput,
  startedAt: number,
  signal: AbortSignal,
) {
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      messages: buildXaiInput(input),
      temperature: 0.4,
    }),
  });
  const body = await readJson(response);

  if (!response.ok) {
    throw new Error(providerError("xai", body));
  }

  const choices = Array.isArray(body.choices) ? body.choices : [];
  const firstChoice = choices[0] as JsonRecord | undefined;
  const message = firstChoice?.message as JsonRecord | undefined;
  const outputText = getText(message?.content) || "";
  const usageBody = body.usage as JsonRecord | undefined;

  return withCost({
    provider: "xai",
    model: input.model,
    outputText,
    rawResponse: body,
    usage: normalizeUsage({
      promptTokens: usageBody?.prompt_tokens,
      completionTokens: usageBody?.completion_tokens,
      totalTokens: usageBody?.total_tokens,
    }),
    latencyMs: Date.now() - startedAt,
    status: "completed",
  });
}
