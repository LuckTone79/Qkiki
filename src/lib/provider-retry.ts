// Transient provider failures that are safe to retry. These show up most often
// in parallel mode, where several requests hit a single provider account at the
// same time. Google/Gemini in particular returns 429 RESOURCE_EXHAUSTED
// (per-minute rate limits) and 503 UNAVAILABLE ("the model is overloaded")
// under concurrency, while sequential runs space the calls out and rarely hit
// them.
const RETRYABLE_PROVIDER_ERROR_PATTERNS: RegExp[] = [
  /\b429\b/,
  /\b503\b/,
  /RESOURCE_EXHAUSTED/i,
  /UNAVAILABLE/i,
  /\boverloaded\b/i,
  /rate limit/i,
  /temporarily unavailable/i,
  /try again later/i,
];

const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_DELAY_MS = 8000;
const RETRY_TIMEOUT_DELAY_MS = 750;

export function isTimeoutProviderErrorMessage(errorMessage: string) {
  return /timed? out/i.test(errorMessage);
}

export function isRetryableProviderErrorMessage(errorMessage: string) {
  if (!errorMessage) {
    return false;
  }

  return RETRYABLE_PROVIDER_ERROR_PATTERNS.some((pattern) =>
    pattern.test(errorMessage),
  );
}

export function getProviderRetryDelayMs(
  errorMessage: string,
  attemptNumber: number,
) {
  if (
    !isTimeoutProviderErrorMessage(errorMessage) &&
    isRetryableProviderErrorMessage(errorMessage)
  ) {
    const exponent = Math.max(0, attemptNumber - 1);
    const base = Math.min(
      RETRY_BASE_DELAY_MS * 2 ** exponent,
      RETRY_MAX_DELAY_MS,
    );
    const jitter = Math.floor(Math.random() * 400);
    return base + jitter;
  }

  return RETRY_TIMEOUT_DELAY_MS;
}
