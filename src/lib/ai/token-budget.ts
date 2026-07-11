type PromptBlock = {
  key: string;
  priority: "highest" | "medium" | "low";
  text: string;
  protected?: boolean;
};

const MAX_RESULTS_IN_ALL_RESULTS = 5;
const TRUNCATION_LABEL = "[Truncated for token budget]";
const TRUNCATION_SUFFIX = `\n\n${TRUNCATION_LABEL}`;
const MIN_TRUNCATED_BLOCK_TOKENS = 8;

export function estimateTextTokens(text: string) {
  if (!text.trim()) {
    return 0;
  }

  const hasKorean = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/.test(text);
  const divisor = hasKorean ? 2.2 : 3.8;
  return Math.max(1, Math.ceil(text.length / divisor));
}

export function estimatePromptBlocksTokens(blocks: Array<{ text: string }>) {
  return blocks.reduce((sum, block) => sum + estimateTextTokens(block.text), 0);
}

function buildTruncatedText(text: string, keepChars: number) {
  const body = text.slice(0, keepChars).trimEnd();
  return body ? `${body}${TRUNCATION_SUFFIX}` : TRUNCATION_LABEL;
}

function truncateBlockText(text: string, targetTokens: number) {
  const currentTokens = estimateTextTokens(text);
  if (currentTokens <= targetTokens) {
    return text;
  }

  const minimumTargetTokens = Math.max(
    MIN_TRUNCATED_BLOCK_TOKENS,
    estimateTextTokens(TRUNCATION_LABEL),
  );
  const boundedTargetTokens = Math.max(minimumTargetTokens, targetTokens);

  let low = 0;
  let high = text.length;
  let best = buildTruncatedText(text, 0);

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = buildTruncatedText(text, mid);
    const candidateTokens = estimateTextTokens(candidate);

    if (candidateTokens <= boundedTargetTokens) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best.length < text.length ? best : text;
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
  const total = () => estimatePromptBlocksTokens(orderedBlocks);
  const priorityRank: Record<PromptBlock["priority"], number> = {
    low: 0,
    medium: 1,
    highest: 2,
  };

  const shrinkCandidateIndexes = (onlyProtected: boolean) =>
    orderedBlocks
      .map((block, index) => ({ block, index }))
      .filter(({ block }) => Boolean(block.protected) === onlyProtected)
      .sort((a, b) => {
        const priorityDelta = priorityRank[a.block.priority] - priorityRank[b.block.priority];
        if (priorityDelta !== 0) {
          return priorityDelta;
        }
        return b.index - a.index;
      })
      .map(({ index }) => index);

  const dropOptionalCandidateIndexes = () =>
    orderedBlocks
      .map((block, index) => ({ block, index }))
      .filter(({ block }) => !block.protected && block.priority !== "highest")
      .sort((a, b) => {
        const priorityDelta = priorityRank[a.block.priority] - priorityRank[b.block.priority];
        if (priorityDelta !== 0) {
          return priorityDelta;
        }
        return b.index - a.index;
      })
      .map(({ index }) => index);

  const dropProtectedCandidateIndexes = () =>
    orderedBlocks
      .map((block, index) => ({ block, index }))
      .filter(({ block }) => Boolean(block.protected))
      .sort((a, b) => {
        const priorityDelta = priorityRank[a.block.priority] - priorityRank[b.block.priority];
        if (priorityDelta !== 0) {
          return priorityDelta;
        }
        return b.index - a.index;
      })
      .map(({ index }) => index);

  const shrinkIndexedBlock = (index: number) => {
    const block = orderedBlocks[index];
    const currentTokens = estimateTextTokens(block.text);
    const minimumTargetTokens = Math.max(
      MIN_TRUNCATED_BLOCK_TOKENS,
      estimateTextTokens(TRUNCATION_LABEL),
    );
    if (currentTokens <= minimumTargetTokens) {
      return false;
    }

    const overflow = total() - tokenBudget;
    const targetTokens = Math.max(
      minimumTargetTokens,
      currentTokens - Math.max(overflow, 8),
    );
    const nextText = truncateBlockText(block.text, targetTokens);
    if (nextText === block.text) {
      return false;
    }

    block.text = nextText;
    return true;
  };

  const dropIndexedBlock = (index: number) => {
    orderedBlocks.splice(index, 1);
    return true;
  };

  const shrinkPass = (onlyProtected: boolean) => {
    let changed = true;
    while (total() > tokenBudget && changed) {
      changed = false;
      for (const index of shrinkCandidateIndexes(onlyProtected)) {
        if (total() <= tokenBudget) {
          break;
        }
        if (shrinkIndexedBlock(index)) {
          changed = true;
          break;
        }
      }
    }
  };

  const dropPass = (candidateIndexes: () => number[]) => {
    let changed = true;
    while (total() > tokenBudget && changed) {
      changed = false;
      for (const index of candidateIndexes()) {
        if (total() <= tokenBudget) {
          break;
        }
        if (dropIndexedBlock(index)) {
          changed = true;
          break;
        }
      }
    }
  };

  if (total() > tokenBudget) {
    shrinkPass(false);
  }

  while (total() > tokenBudget) {
    dropPass(dropOptionalCandidateIndexes);
    if (total() <= tokenBudget) {
      break;
    }
    shrinkPass(true);
    if (total() <= tokenBudget) {
      break;
    }
    dropPass(dropProtectedCandidateIndexes);
    break;
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
