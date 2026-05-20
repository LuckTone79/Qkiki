type PromptBlock = {
  key: string;
  priority: "highest" | "medium" | "low";
  text: string;
};

const MAX_RESULTS_IN_ALL_RESULTS = 5;

function estimateLanguageAwareTokens(text: string) {
  if (!text.trim()) {
    return 0;
  }

  const hasKorean = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/.test(text);
  const divisor = hasKorean ? 2.2 : 3.8;
  return Math.max(1, Math.ceil(text.length / divisor));
}

export function getMaxInputTokensForModel(model: string) {
  const normalized = model.toLowerCase();

  if (normalized.includes("opus")) {
    return 180_000;
  }
  if (normalized.includes("sonnet")) {
    return 120_000;
  }
  if (normalized.includes("gpt-5.5")) {
    return 128_000;
  }
  if (normalized.includes("gpt-5.4")) {
    return 128_000;
  }
  if (normalized.includes("mini") || normalized.includes("haiku")) {
    return 64_000;
  }

  return 96_000;
}

export function limitAllResultsTexts(results: string[]) {
  return results.filter(Boolean).slice(-MAX_RESULTS_IN_ALL_RESULTS);
}

export function fitPromptBlocksToBudget(input: {
  model: string;
  reservedOutputTokens?: number;
  blocks: PromptBlock[];
}) {
  const maxInputTokens = getMaxInputTokensForModel(input.model);
  const tokenBudget = Math.max(
    4_000,
    maxInputTokens - (input.reservedOutputTokens ?? 8_000),
  );

  const orderedBlocks = [...input.blocks].map((block) => ({ ...block }));
  const total = () =>
    orderedBlocks.reduce((sum, block) => sum + estimateLanguageAwareTokens(block.text), 0);

  if (total() <= tokenBudget) {
    return {
      tokenBudget,
      estimatedInputTokens: total(),
      blocks: orderedBlocks,
    };
  }

  const priorities: PromptBlock["priority"][] = ["low", "medium"];
  for (const priority of priorities) {
    for (const block of orderedBlocks) {
      if (block.priority !== priority || total() <= tokenBudget) {
        continue;
      }

      const currentTokens = estimateLanguageAwareTokens(block.text);
      const targetTokens = Math.max(
        256,
        currentTokens - Math.ceil((total() - tokenBudget) * 1.1),
      );
      const charsPerToken = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/.test(block.text)
        ? 2
        : 4;
      const targetChars = Math.max(400, targetTokens * charsPerToken);
      if (block.text.length > targetChars) {
        block.text = `${block.text.slice(0, targetChars).trim()}\n\n[Truncated for token budget]`;
      }
    }
  }

  return {
    tokenBudget,
    estimatedInputTokens: total(),
    blocks: orderedBlocks,
  };
}

export function previewText(text: string | null | undefined, maxChars = 240) {
  if (!text) {
    return null;
  }

  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, maxChars - 3)}...`;
}
