const DEFAULT_TEXT_OUTPUT_TOKEN_LIMIT = 1400;

const TEXT_OUTPUT_TOKEN_LIMITS: Readonly<Record<string, number>> = {
  generate: 2200,
  improve: 2200,
  brainstorm: 1800,
  summarize: 900,
  simplify: 900,
  critique: 1400,
  fact_check: 1400,
  consistency_review: 1400,
  code_review: 1400,
  follow_up: 1400,
  rerun: 1400,
  parallel_comparison_summary: 1200,
};

export function getQuotedOutputTokenLimit(requestType?: string | null) {
  return requestType
    ? TEXT_OUTPUT_TOKEN_LIMITS[requestType] ?? DEFAULT_TEXT_OUTPUT_TOKEN_LIMIT
    : DEFAULT_TEXT_OUTPUT_TOKEN_LIMIT;
}

export function buildResponsesOutputTokenConfig(outputTokenLimit: number) {
  return { max_output_tokens: outputTokenLimit } as const;
}

export function buildMessagesOutputTokenConfig(outputTokenLimit: number) {
  return { max_tokens: outputTokenLimit } as const;
}

export function buildGeminiOutputTokenConfig(outputTokenLimit: number) {
  return { maxOutputTokens: outputTokenLimit } as const;
}
