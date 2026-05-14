import "server-only";

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  getProviderCatalog,
  isProviderName,
  normalizeProviderModel,
} from "@/lib/ai/provider-catalog";
import {
  acquireProviderLease,
  releaseProviderLease,
} from "@/lib/provider-concurrency";
import { estimateCost } from "@/lib/ai/pricing";
import {
  decryptSecretWithMetadata,
  encryptSecret,
  hasDedicatedDbEncryptionKey,
} from "@/lib/secret-crypto";
import type {
  ProviderAttachmentInput,
  ProviderCallInput,
  ProviderCallResult,
  ProviderName,
  UsageInfo,
} from "@/lib/ai/types";

type JsonRecord = Record<string, unknown>;

type ProviderRuntimeConfig = {
  provider: ProviderName;
  apiKey: string | null;
  defaultModel: string;
  fallbackProvider: ProviderName | null;
  timeoutSeconds: number;
};

const DEFAULT_PROVIDER_TIMEOUT_SECONDS = 90;
const ANTHROPIC_MAX_TOKENS = 4096;
const ANTHROPIC_MAX_CONTINUATIONS = 2;
const ANTHROPIC_CONTINUE_PROMPT =
  "Continue exactly where you left off. Do not repeat prior text. Return only the continuation.";

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

function extractContentPartsText(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((part) => {
      if (!part || typeof part !== "object") {
        return "";
      }

      if ("text" in part && typeof part.text === "string") {
        return part.text;
      }

      if ("refusal" in part && typeof part.refusal === "string") {
        return part.refusal;
      }

      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractChatMessageText(message: JsonRecord | undefined) {
  if (!message) {
    return "";
  }

  const directContent = getText(message.content);
  if (directContent) {
    return directContent;
  }

  const contentPartsText = extractContentPartsText(message.content);
  if (contentPartsText) {
    return contentPartsText;
  }

  const nestedContentPartsText = extractContentPartsText(message.content_parts);
  if (nestedContentPartsText) {
    return nestedContentPartsText;
  }

  return getText(message.refusal);
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

function normalizeAnthropicModel(model: string) {
  return normalizeProviderModel("anthropic", model);
}

function isOpenAiReasoningModel(model: string) {
  return model.startsWith("gpt-5");
}

function getOpenAiReasoningEffort(model: string) {
  if (!isOpenAiReasoningModel(model)) {
    return undefined;
  }

  return "low";
}

function isTimeoutLikeError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === "TimeoutError" ||
    error.name === "AbortError" ||
    /timed? out/i.test(error.message) ||
    /aborted due to timeout/i.test(error.message)
  );
}

function formatProviderRuntimeError(
  provider: ProviderName,
  error: unknown,
) {
  if (isTimeoutLikeError(error)) {
    return `${provider}: provider request timed out before a response was completed.`;
  }

  return error instanceof Error ? error.message : "Provider request failed.";
}

function createProviderTimeoutError(
  provider: ProviderName,
  timeoutSeconds: number,
) {
  const error = new Error(
    `${provider}: provider request timed out after ${timeoutSeconds} seconds.`,
  );
  error.name = "TimeoutError";
  return error;
}

function buildChatCompletionInput(input: ProviderCallInput) {
  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: buildPromptText(input.prompt, input.attachments),
    },
  ];

  getImageAttachments(input.attachments).forEach((attachment) => {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${attachment.mimeType};base64,${attachment.dataBase64}`,
        detail: "high",
      },
    });
  });

  return [{ role: "user", content }];
}

function buildOpenAiResponsesInput(input: ProviderCallInput) {
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

function buildAnthropicContinuationContent(text: string) {
  return [{ type: "text", text }];
}

function extractAnthropicText(body: JsonRecord) {
  const content = Array.isArray(body.content) ? body.content : [];
  return content
    .map((entry) =>
      entry && typeof entry === "object" && "text" in entry
        ? String((entry as { text: unknown }).text)
        : "",
    )
    .join("\n")
    .trim();
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

function extractOpenAiResponsesText(body: JsonRecord) {
  const directOutputText = getText(body.output_text);
  if (directOutputText) {
    return directOutputText;
  }

  const output = Array.isArray(body.output) ? body.output : [];
  const text = output
    .flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const content = Array.isArray(item.content)
        ? (item.content as Array<Record<string, unknown>>)
        : [];

      return content.map((part) => {
        if ("text" in part && typeof part.text === "string") {
          return part.text;
        }

        if ("refusal" in part && typeof part.refusal === "string") {
          return part.refusal;
        }

        return "";
      });
    })
    .filter(Boolean)
    .join("\n")
    .trim();

  return text;
}

function getOpenAiResponsesStatus(body: JsonRecord) {
  const status = getText(body.status);
  return status || "unknown";
}

function getOpenAiResponsesError(body: JsonRecord) {
  const status = getOpenAiResponsesStatus(body);
  const error = body.error;
  const incompleteDetails = body.incomplete_details;

  if (error && typeof error === "object" && "message" in error) {
    return `openai: ${String((error as { message: unknown }).message)}`;
  }

  if (
    incompleteDetails &&
    typeof incompleteDetails === "object" &&
    "reason" in incompleteDetails
  ) {
    return `openai: response ended with status ${status} (${String(
      (incompleteDetails as { reason: unknown }).reason,
    )})`;
  }

  return `openai: response ended with status ${status}`;
}

async function waitForSignalSafeDelay(signal: AbortSignal, ms: number) {
  if (signal.aborted) {
    throw signal.reason ?? new Error("The operation was aborted.");
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      cleanup();
      reject(signal.reason ?? new Error("The operation was aborted."));
    };

    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function getProviderRuntimeConfig(provider: ProviderName) {
  const catalog = getProviderCatalog(provider);
  const envValue = process.env[catalog.envKey];
  const config = await prisma.adminProviderConfig.findUnique({
    where: { providerName: provider },
  });
  const configuredModel = normalizeProviderModel(
    provider,
    config?.defaultModel ?? catalog.defaultModel,
  );
  const defaultModel = catalog.models.includes(configuredModel)
    ? configuredModel
    : catalog.defaultModel;
  const fallbackProvider =
    config?.fallbackProvider &&
    isProviderName(config.fallbackProvider) &&
    config.fallbackProvider !== provider
      ? config.fallbackProvider
      : null;
  const timeoutSeconds =
    typeof config?.timeoutSeconds === "number" && config.timeoutSeconds > 0
      ? config.timeoutSeconds
      : DEFAULT_PROVIDER_TIMEOUT_SECONDS;
  const runtimeBase: Omit<ProviderRuntimeConfig, "apiKey"> = {
    provider,
    defaultModel,
    fallbackProvider,
    timeoutSeconds,
  };

  if (envValue?.trim()) {
    return {
      ...runtimeBase,
      apiKey: envValue.trim(),
    };
  }

  if (
    config?.apiKeyCiphertext &&
    config.apiKeyIv &&
    config.apiKeyTag
  ) {
    const decrypted = decryptSecretWithMetadata({
      ciphertext: config.apiKeyCiphertext,
      iv: config.apiKeyIv,
      tag: config.apiKeyTag,
    });

    if (
      hasDedicatedDbEncryptionKey() &&
      decrypted.keySource !== "db_encryption_key"
    ) {
      const reencrypted = encryptSecret(decrypted.value);
      await prisma.adminProviderConfig.update({
        where: { providerName: provider },
        data: {
          apiKeyCiphertext: reencrypted.ciphertext,
          apiKeyIv: reencrypted.iv,
          apiKeyTag: reencrypted.tag,
        },
      });
    }

    return {
      ...runtimeBase,
      apiKey: decrypted.value,
    };
  }

  return {
    ...runtimeBase,
    apiKey: null,
  };
}

export async function getApiKeyForProvider(provider: ProviderName) {
  const runtime = await getProviderRuntimeConfig(provider);
  return runtime.apiKey;
}

export async function getDefaultModelForProvider(provider: ProviderName) {
  const runtime = await getProviderRuntimeConfig(provider);
  return runtime.defaultModel;
}

function buildFallbackResponse(
  input: ProviderCallInput,
  failedResult: ProviderCallResult,
  fallbackResult: ProviderCallResult,
): ProviderCallResult {
  return {
    ...fallbackResult,
    rawResponse: {
      fallbackFrom: {
        provider: input.provider,
        model: input.model,
        errorMessage: failedResult.errorMessage ?? null,
      },
      response: fallbackResult.rawResponse,
    },
  };
}

async function executeProviderCall(
  runtime: ProviderRuntimeConfig,
  input: ProviderCallInput,
): Promise<ProviderCallResult> {
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
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort(
        createProviderTimeoutError(input.provider, runtime.timeoutSeconds),
      );
    }, runtime.timeoutSeconds * 1000);
    const signal = controller.signal;

    try {
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
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return {
      provider: input.provider,
      model: input.model,
      outputText: "",
      rawResponse: null,
      latencyMs: Date.now() - startedAt,
      status: "failed",
      errorMessage: formatProviderRuntimeError(
        input.provider,
        error,
      ),
    };
  }
}

export async function callProvider(
  userId: string,
  input: ProviderCallInput,
): Promise<ProviderCallResult> {
  const baseOwnerKind = input.concurrencyOwner?.ownerKind ?? "provider_call";
  const baseOwnerId =
    input.concurrencyOwner?.ownerId ??
    `user:${userId}:${input.provider}:${crypto.randomUUID()}`;

  const executeAttemptWithLease = async (
    provider: ProviderName,
    runtimeConfig: ProviderRuntimeConfig,
    runtimeInput: ProviderCallInput,
    ownerSuffix: string,
  ) => {
    const lease = await acquireProviderLease({
      provider,
      model: runtimeInput.model,
      owner: {
        ownerKind: baseOwnerKind,
        ownerId: `${baseOwnerId}:${ownerSuffix}`,
      },
    });

    try {
      return await executeProviderCall(runtimeConfig, runtimeInput);
    } finally {
      await releaseProviderLease(lease.id);
    }
  };

  const runtime = await getProviderRuntimeConfig(input.provider);
  const primaryResult = await executeAttemptWithLease(
    input.provider,
    runtime,
    input,
    "primary",
  );

  if (
    primaryResult.status === "completed" ||
    !runtime.fallbackProvider
  ) {
    return primaryResult;
  }

  console.warn("[provider] primary request failed", {
    provider: input.provider,
    model: input.model,
    fallbackProvider: runtime.fallbackProvider,
    errorMessage: primaryResult.errorMessage ?? null,
  });

  const fallbackRuntime = await getProviderRuntimeConfig(runtime.fallbackProvider);
  const fallbackResult = await executeAttemptWithLease(
    runtime.fallbackProvider,
    fallbackRuntime,
    {
      ...input,
      provider: runtime.fallbackProvider,
      model: fallbackRuntime.defaultModel,
    },
    `fallback:${runtime.fallbackProvider}`,
  );

  if (fallbackResult.status === "completed") {
    console.warn("[provider] fallback request succeeded", {
      requestedProvider: input.provider,
      requestedModel: input.model,
      fallbackProvider: fallbackResult.provider,
      fallbackModel: fallbackResult.model,
    });
    return buildFallbackResponse(input, primaryResult, fallbackResult);
  }

  console.error("[provider] fallback request failed", {
    requestedProvider: input.provider,
    requestedModel: input.model,
    requestedError: primaryResult.errorMessage ?? null,
    fallbackProvider: fallbackResult.provider,
    fallbackModel: fallbackResult.model,
    fallbackError: fallbackResult.errorMessage ?? null,
  });

  return primaryResult;
}

async function callOpenAi(
  apiKey: string,
  input: ProviderCallInput,
  startedAt: number,
  signal: AbortSignal,
) {
  const reasoningEffort = getOpenAiReasoningEffort(input.model);
  const createResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      input: buildOpenAiResponsesInput(input),
      background: false,
      store: false,
      ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
    }),
  });
  let body = await readJson(createResponse);

  if (!createResponse.ok) {
    throw new Error(providerError("openai", body));
  }

  const responseId = getText(body.id);
  let status = getOpenAiResponsesStatus(body);

  while (
    responseId &&
    (status === "queued" || status === "in_progress")
  ) {
    await waitForSignalSafeDelay(signal, 1000);

    const pollResponse = await fetch(
      `https://api.openai.com/v1/responses/${encodeURIComponent(responseId)}`,
      {
        method: "GET",
        signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    body = await readJson(pollResponse);

    if (!pollResponse.ok) {
      throw new Error(providerError("openai", body));
    }

    status = getOpenAiResponsesStatus(body);
  }

  if (status !== "completed") {
    throw new Error(getOpenAiResponsesError(body));
  }

  const outputText = extractOpenAiResponsesText(body);
  const usageBody = body.usage as JsonRecord | undefined;

  return withCost({
    provider: "openai",
    model: input.model,
    outputText,
    rawResponse: body,
    usage: normalizeUsage({
      promptTokens: usageBody?.prompt_tokens ?? usageBody?.input_tokens,
      completionTokens:
        usageBody?.completion_tokens ?? usageBody?.output_tokens,
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
  const messages: Array<Record<string, unknown>> = [
    { role: "user", content: buildAnthropicContent(input) },
  ];
  const rawResponses: JsonRecord[] = [];
  const outputParts: string[] = [];
  let promptTokens = 0;
  let completionTokens = 0;

  for (
    let continuationIndex = 0;
    continuationIndex <= ANTHROPIC_MAX_CONTINUATIONS;
    continuationIndex += 1
  ) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: normalizeAnthropicModel(input.model),
        max_tokens: ANTHROPIC_MAX_TOKENS,
        messages,
      }),
    });
    const body = await readJson(response);

    if (!response.ok) {
      throw new Error(providerError("anthropic", body));
    }

    rawResponses.push(body);
    const text = extractAnthropicText(body);
    if (text) {
      outputParts.push(text);
    }

    const usageBody = body.usage as JsonRecord | undefined;
    promptTokens += typeof usageBody?.input_tokens === "number" ? usageBody.input_tokens : 0;
    completionTokens +=
      typeof usageBody?.output_tokens === "number" ? usageBody.output_tokens : 0;

    const stopReason = getText(body.stop_reason);
    if (stopReason === "end_turn" || stopReason === "stop_sequence") {
      return withCost({
        provider: "anthropic",
        model: input.model,
        outputText: outputParts.join("\n").trim(),
        rawResponse:
          rawResponses.length === 1
            ? rawResponses[0]
            : {
                responses: rawResponses,
                continuationCount: rawResponses.length - 1,
              },
        usage: normalizeUsage({
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        }),
        latencyMs: Date.now() - startedAt,
        status: "completed",
      });
    }

    if (stopReason !== "max_tokens") {
      throw new Error(
        `anthropic: response ended with stop_reason ${stopReason || "unknown"}.`,
      );
    }

    if (continuationIndex >= ANTHROPIC_MAX_CONTINUATIONS) {
      throw new Error("anthropic: response reached the token limit before completion.");
    }

    messages.push({
      role: "assistant",
      content: Array.isArray(body.content)
        ? body.content
        : buildAnthropicContinuationContent(text),
    });
    messages.push({
      role: "user",
      content: buildAnthropicContinuationContent(ANTHROPIC_CONTINUE_PROMPT),
    });
  }

  return withCost({
    provider: "anthropic",
    model: input.model,
    outputText: outputParts.join("\n").trim(),
    rawResponse: rawResponses,
    usage: normalizeUsage({
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
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
      messages: buildChatCompletionInput(input),
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
  const outputText = extractChatMessageText(message);
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
