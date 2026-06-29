export const CREDIT_PRICING_VERSION = "credit-v2-image-20260615";
export const CREDIT_FX_RATE_KRW_PER_USD = 1560;
export const CREDIT_RISK_MULTIPLIER = 2.2;
export const PROTECTED_KRW_PER_CREDIT = 10;

export type ModelPricing = {
  promptPerMillion: number;
  completionPerMillion: number;
};

export type ImageGenerationPricing = {
  perImageUsd: number;
  pricingBasis: "per_image";
  defaultImageCount: number;
  reference: string;
};

export const MODEL_PRICING: Record<string, ModelPricing> = {
  "openai:gpt-5.5": { promptPerMillion: 5, completionPerMillion: 22.5 },
  "openai:gpt-5.4": { promptPerMillion: 2.5, completionPerMillion: 11.25 },
  "openai:gpt-5.4-mini": { promptPerMillion: 0.375, completionPerMillion: 2.25 },
  "openai:gpt-5.4-nano": { promptPerMillion: 0.1, completionPerMillion: 0.625 },

  "anthropic:claude-opus-4-8": { promptPerMillion: 5, completionPerMillion: 25 },
  "anthropic:claude-sonnet-4-6": { promptPerMillion: 3, completionPerMillion: 15 },
  "anthropic:claude-haiku-4-5": { promptPerMillion: 1, completionPerMillion: 5 },

  "google:gemini-3.1-pro-preview": { promptPerMillion: 2, completionPerMillion: 12 },
  "google:gemini-3-flash-preview": { promptPerMillion: 0.5, completionPerMillion: 3 },
  "google:gemini-2.5-pro": { promptPerMillion: 1.25, completionPerMillion: 10 },
  "google:gemini-2.5-flash": { promptPerMillion: 0.3, completionPerMillion: 2.5 },
  "google:gemini-2.5-flash-lite": { promptPerMillion: 0.1, completionPerMillion: 0.4 },

  "xai:grok-4.3": { promptPerMillion: 1.25, completionPerMillion: 2.5 },
  "xai:grok-4.20-multi-agent": { promptPerMillion: 1.25, completionPerMillion: 2.5 },
  "xai:grok-4.20-reasoning": { promptPerMillion: 1.25, completionPerMillion: 2.5 },
  "xai:grok-4.20-non-reasoning": { promptPerMillion: 1.25, completionPerMillion: 2.5 },
};

export const IMAGE_GENERATION_PRICING: Record<string, ImageGenerationPricing> = {
  "openai:gpt-image-1": {
    perImageUsd: 0.042,
    pricingBasis: "per_image",
    defaultImageCount: 1,
    reference: "medium 1024x1024 image output",
  },
  "openai:gpt-image-2": {
    perImageUsd: 0.053,
    pricingBasis: "per_image",
    defaultImageCount: 1,
    reference: "medium 1024x1024 image output",
  },
  "google:imagen-4.0-fast-generate-001": {
    perImageUsd: 0.02,
    pricingBasis: "per_image",
    defaultImageCount: 1,
    reference: "Imagen 4 Fast generated image",
  },
  "google:imagen-4.0-generate-001": {
    perImageUsd: 0.04,
    pricingBasis: "per_image",
    defaultImageCount: 1,
    reference: "Imagen 4 Standard generated image",
  },
  "google:imagen-4.0-ultra-generate-001": {
    perImageUsd: 0.06,
    pricingBasis: "per_image",
    defaultImageCount: 1,
    reference: "Imagen 4 Ultra generated image",
  },
  "google:gemini-2.5-flash-image": {
    perImageUsd: 0.039,
    pricingBasis: "per_image",
    defaultImageCount: 1,
    reference: "Gemini 2.5 Flash Image 1024x1024 output",
  },
  "google:gemini-3-pro-image": {
    perImageUsd: 0.134,
    pricingBasis: "per_image",
    defaultImageCount: 1,
    reference: "Gemini 3 Pro Image 1K/2K output",
  },
  "xai:grok-imagine-image": {
    perImageUsd: 0.02,
    pricingBasis: "per_image",
    defaultImageCount: 1,
    reference: "Grok Imagine Image 1K/2K output",
  },
  "xai:grok-imagine-image-quality": {
    perImageUsd: 0.02,
    pricingBasis: "per_image",
    defaultImageCount: 1,
    reference: "Grok Imagine Image quality output",
  },
  "xai:grok-2-image-1212": {
    perImageUsd: 0.02,
    pricingBasis: "per_image",
    defaultImageCount: 1,
    reference: "legacy xAI image-generation alias",
  },
};

const FALLBACK_MODEL_PRICING: ModelPricing = {
  promptPerMillion: 1.25,
  completionPerMillion: 10,
};

type CreditConversionOptions = {
  fxRateKrwPerUsd?: number;
  riskMultiplier?: number;
  protectedKrwPerCredit?: number;
};

export type CreditEstimateLine = {
  provider: string;
  model: string;
  actionType: string;
  billingKind: "tokens" | "image";
  unitCount?: number;
  unitLabel?: "image";
  inputTokens: number;
  outputTokens: number;
  rawCostUsd: number;
  credits: number;
};

export type CreditEstimate = {
  estimatedCredits: number;
  estimatedRawCostUsd: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  plannedCallCount: number;
  pricingVersion: string;
  callBreakdown: CreditEstimateLine[];
};

type TargetLike = {
  provider: string;
  model: string;
};

type WorkflowStepLike = {
  orderIndex: number;
  actionType: string;
  targetProvider: string;
  targetModel: string;
  sourceMode?: string;
  instructionTemplate?: string | null;
};

type WorkflowControlLike = {
  repeat?: {
    enabled: boolean;
    startStepOrder: number;
    endStepOrder: number;
    repeatCount: number;
  };
  repeatBlocks?: Array<{
    startStepOrder: number;
    endStepOrder: number;
    repeatCount: number;
  }>;
};

export type WorkbenchCreditEstimateInput = {
  mode: "parallel" | "sequential" | "image";
  originalInput: string;
  additionalInstruction?: string | null;
  targets?: TargetLike[];
  steps?: WorkflowStepLike[];
  workflowControl?: WorkflowControlLike;
};

export function getModelPricing(provider: string, model: string) {
  return MODEL_PRICING[`${provider}:${model}`] ?? FALLBACK_MODEL_PRICING;
}

export function getImageGenerationPricing(provider: string, model: string) {
  return IMAGE_GENERATION_PRICING[`${provider}:${model}`];
}

function normalizeImageCount(imageCount: number | undefined) {
  if (!Number.isFinite(imageCount ?? 1)) {
    return 1;
  }

  return Math.max(1, Math.ceil(imageCount ?? 1));
}

export function estimateImageGenerationCostUsd(input: {
  provider: string;
  model: string;
  imageCount?: number;
}) {
  const pricing = getImageGenerationPricing(input.provider, input.model);
  if (!pricing) {
    return undefined;
  }

  return pricing.perImageUsd * normalizeImageCount(input.imageCount);
}

export function estimateTextTokens(text: string | null | undefined) {
  const normalized = text?.trim() ?? "";
  if (!normalized) {
    return 0;
  }

  const hasKorean = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/.test(normalized);
  const charsPerToken = hasKorean ? 2.2 : 3.8;
  return Math.max(1, Math.ceil(normalized.length / charsPerToken));
}

export function costUsdToCredits(
  costUsd: number,
  options: CreditConversionOptions = {},
) {
  if (!Number.isFinite(costUsd) || costUsd <= 0) {
    return 0;
  }

  const fxRateKrwPerUsd =
    options.fxRateKrwPerUsd ?? CREDIT_FX_RATE_KRW_PER_USD;
  const riskMultiplier =
    options.riskMultiplier ?? CREDIT_RISK_MULTIPLIER;
  const protectedKrwPerCredit =
    options.protectedKrwPerCredit ?? PROTECTED_KRW_PER_CREDIT;

  return Math.max(
    1,
    Math.ceil((costUsd * fxRateKrwPerUsd * riskMultiplier) / protectedKrwPerCredit),
  );
}

export function estimateProviderCostUsd(input: {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}) {
  const pricing = getModelPricing(input.provider, input.model);
  return (
    (input.promptTokens / 1_000_000) * pricing.promptPerMillion +
    (input.completionTokens / 1_000_000) * pricing.completionPerMillion
  );
}

export function estimateOutputTokensForAction(actionType: string) {
  if (actionType === "generate" || actionType === "improve") {
    return 2200;
  }
  if (actionType === "brainstorm") {
    return 1800;
  }
  if (actionType === "code_review") {
    return 2600;
  }
  if (actionType === "scenario_develop") {
    return 3000;
  }
  if (actionType === "deep_dive") {
    return 2400;
  }
  if (actionType === "summarize" || actionType === "simplify") {
    return 900;
  }
  if (
    actionType === "critique" ||
    actionType === "fact_check" ||
    actionType === "consistency_review"
  ) {
    return 1400;
  }
  return 1400;
}

function estimateOutputTokensForModel(input: {
  provider: string;
  model: string;
  actionType: string;
}) {
  if (getImageGenerationPricing(input.provider, input.model)) {
    return 0;
  }

  return estimateOutputTokensForAction(input.actionType);
}

function normalizeRepeatBlocks(workflowControl?: WorkflowControlLike) {
  if (Array.isArray(workflowControl?.repeatBlocks)) {
    return [...workflowControl.repeatBlocks].sort((a, b) =>
      a.startStepOrder === b.startStepOrder
        ? a.endStepOrder - b.endStepOrder
        : a.startStepOrder - b.startStepOrder,
    );
  }

  if (workflowControl?.repeat?.enabled) {
    return [
      {
        startStepOrder: workflowControl.repeat.startStepOrder,
        endStepOrder: workflowControl.repeat.endStepOrder,
        repeatCount: workflowControl.repeat.repeatCount,
      },
    ];
  }

  return [];
}

function expandSteps(steps: WorkflowStepLike[], workflowControl?: WorkflowControlLike) {
  const repeatBlocks = normalizeRepeatBlocks(workflowControl);
  if (!repeatBlocks.length) {
    return [...steps].sort((a, b) => a.orderIndex - b.orderIndex);
  }

  const sortedSteps = [...steps].sort((a, b) => a.orderIndex - b.orderIndex);
  const expanded: WorkflowStepLike[] = [];
  let cursor = 1;
  let previousEnd = 0;

  for (const block of repeatBlocks) {
    if (
      block.startStepOrder < 1 ||
      block.endStepOrder > sortedSteps.length ||
      block.startStepOrder > block.endStepOrder ||
      block.repeatCount < 1 ||
      block.startStepOrder <= previousEnd
    ) {
      continue;
    }

    while (cursor < block.startStepOrder) {
      expanded.push(sortedSteps[cursor - 1]);
      cursor += 1;
    }

    const repeated = sortedSteps.slice(block.startStepOrder - 1, block.endStepOrder);
    for (let iteration = 0; iteration < block.repeatCount; iteration += 1) {
      expanded.push(...repeated);
    }

    previousEnd = block.endStepOrder;
    cursor = block.endStepOrder + 1;
  }

  while (cursor <= sortedSteps.length) {
    expanded.push(sortedSteps[cursor - 1]);
    cursor += 1;
  }

  return expanded.slice(0, 50);
}

function sumEstimateLines(lines: CreditEstimateLine[]): CreditEstimate {
  return {
    estimatedCredits: lines.reduce((sum, line) => sum + line.credits, 0),
    estimatedRawCostUsd: Number(
      lines.reduce((sum, line) => sum + line.rawCostUsd, 0).toFixed(6),
    ),
    estimatedInputTokens: lines.reduce((sum, line) => sum + line.inputTokens, 0),
    estimatedOutputTokens: lines.reduce((sum, line) => sum + line.outputTokens, 0),
    plannedCallCount: lines.length,
    pricingVersion: CREDIT_PRICING_VERSION,
    callBreakdown: lines,
  };
}

function estimateLine(input: {
  provider: string;
  model: string;
  actionType: string;
  inputTokens: number;
  outputTokens: number;
  imageCount?: number;
}) {
  const imageRawCostUsd = estimateImageGenerationCostUsd({
    provider: input.provider,
    model: input.model,
    imageCount: input.imageCount,
  });

  if (imageRawCostUsd !== undefined) {
    return {
      provider: input.provider,
      model: input.model,
      actionType: input.actionType,
      billingKind: "image",
      unitCount: normalizeImageCount(input.imageCount),
      unitLabel: "image",
      inputTokens: input.inputTokens,
      outputTokens: 0,
      rawCostUsd: Number(imageRawCostUsd.toFixed(6)),
      credits: costUsdToCredits(imageRawCostUsd),
    } satisfies CreditEstimateLine;
  }

  const rawCostUsd = estimateProviderCostUsd({
    provider: input.provider,
    model: input.model,
    promptTokens: input.inputTokens,
    completionTokens: input.outputTokens,
  });

  return {
    provider: input.provider,
    model: input.model,
    actionType: input.actionType,
    billingKind: "tokens",
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    rawCostUsd: Number(rawCostUsd.toFixed(6)),
    credits: costUsdToCredits(rawCostUsd),
  } satisfies CreditEstimateLine;
}

export function estimateWorkbenchRunCredits(input: WorkbenchCreditEstimateInput) {
  const baseInputTokens =
    estimateTextTokens(input.originalInput) +
    estimateTextTokens(input.additionalInstruction) +
    350;

  if (input.mode === "parallel" || input.mode === "image") {
    return sumEstimateLines(
      (input.targets ?? []).map((target) =>
        estimateLine({
          provider: target.provider,
          model: target.model,
          actionType: "parallel_review",
          inputTokens: baseInputTokens,
          outputTokens: estimateOutputTokensForModel({
            provider: target.provider,
            model: target.model,
            actionType: "generate",
          }),
        }),
      ),
    );
  }

  let previousOutputTokens = 0;
  let accumulatedOutputTokens = 0;
  const expandedSteps = expandSteps(input.steps ?? [], input.workflowControl);
  const lines = expandedSteps.map((step) => {
    const instructionTokens = estimateTextTokens(step.instructionTemplate);
    const sourceTokens =
      step.sourceMode === "all_results"
        ? Math.min(12_000, accumulatedOutputTokens)
        : step.sourceMode === "previous" || step.sourceMode === "selected_result"
          ? previousOutputTokens
          : 0;
    const outputTokens = estimateOutputTokensForModel({
      provider: step.targetProvider,
      model: step.targetModel,
      actionType: step.actionType,
    });
    const line = estimateLine({
      provider: step.targetProvider,
      model: step.targetModel,
      actionType: step.actionType,
      inputTokens: baseInputTokens + instructionTokens + sourceTokens + 120,
      outputTokens,
    });
    previousOutputTokens = outputTokens;
    accumulatedOutputTokens += outputTokens;
    return line;
  });

  return sumEstimateLines(lines);
}

export function estimateTargetFanoutCredits(input: {
  actionType: string;
  inputText: string;
  additionalInstruction?: string | null;
  targets: TargetLike[];
}) {
  const baseInputTokens =
    estimateTextTokens(input.inputText) +
    estimateTextTokens(input.additionalInstruction) +
    350;
  return sumEstimateLines(
    input.targets.map((target) =>
      estimateLine({
        provider: target.provider,
        model: target.model,
        actionType: input.actionType,
        inputTokens: baseInputTokens,
        outputTokens: estimateOutputTokensForModel({
          provider: target.provider,
          model: target.model,
          actionType: input.actionType,
        }),
      }),
    ),
  );
}

export function estimateComparisonSummaryCredits(input: {
  originalInput: string;
  resultCount: number;
  averageResultCharCount?: number;
}) {
  const averageResultCharCount = input.averageResultCharCount ?? 3000;
  const inputTokens =
    estimateTextTokens(input.originalInput) +
    Math.max(0, input.resultCount) * estimateTextTokens("x".repeat(averageResultCharCount)) +
    500;

  return sumEstimateLines([
    estimateLine({
      provider: "openai",
      model: "gpt-5.5",
      actionType: "parallel_comparison_summary",
      inputTokens,
      outputTokens: 1200,
    }),
  ]);
}
