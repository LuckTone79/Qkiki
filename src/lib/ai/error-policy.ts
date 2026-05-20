export const AI_ERROR_CODES = {
  PROVIDER_TIMEOUT: "PROVIDER_TIMEOUT",
  PROVIDER_RATE_LIMIT: "PROVIDER_RATE_LIMIT",
  PROVIDER_AUTH: "PROVIDER_AUTH",
  PROVIDER_BAD_REQUEST: "PROVIDER_BAD_REQUEST",
  PROVIDER_SERVER_ERROR: "PROVIDER_SERVER_ERROR",
  STEP_STALE_TIMEOUT: "STEP_STALE_TIMEOUT",
  USER_CANCELED: "USER_CANCELED",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  UNKNOWN: "UNKNOWN",
} as const;

export const AI_ERROR_POLICY = {
  PROVIDER_TIMEOUT: {
    retryable: true,
    maxAttempts: 3,
    timeoutMultiplier: 1.5,
    maxTimeoutMs: 240_000,
    userMessage: "모델 응답이 지연되어 자동 재시도 중입니다.",
  },
  PROVIDER_RATE_LIMIT: {
    retryable: true,
    maxAttempts: 5,
    backoff: {
      type: "exponential",
      initialDelayMs: 1_000,
      multiplier: 2,
      maxDelayMs: 60_000,
      jitter: "full",
    },
    respectRetryAfter: true,
    userMessage: "공급자 요청 제한으로 잠시 후 재시도합니다.",
  },
  PROVIDER_AUTH: {
    retryable: false,
    alertAdmin: true,
    userMessage: "공급자 인증 설정 확인이 필요합니다.",
  },
  PROVIDER_BAD_REQUEST: {
    retryable: false,
    userMessage: "입력 또는 모델 요청 형식을 확인해야 합니다.",
  },
  PROVIDER_SERVER_ERROR: {
    retryable: true,
    maxAttempts: 2,
    userMessage: "공급자 서버 문제로 재시도 중입니다.",
  },
  STEP_STALE_TIMEOUT: {
    retryable: false,
    userMessage: "실행 시간이 초과되어 해당 단계를 종료했습니다.",
  },
  USER_CANCELED: {
    retryable: false,
    userMessage: "사용자가 작업을 중지했습니다.",
  },
  QUOTA_EXCEEDED: {
    retryable: false,
    userMessage: "사용량 한도를 초과했습니다.",
  },
  UNKNOWN: {
    retryable: false,
    userMessage: "알 수 없는 오류가 발생했습니다.",
  },
} as const;

export type AiErrorCode = keyof typeof AI_ERROR_POLICY;

export function normalizeAiError(error: unknown): {
  code: AiErrorCode;
  message: string;
  retryable: boolean;
} {
  const message = error instanceof Error ? error.message : "Unknown error.";
  const lower = message.toLowerCase();

  if (error instanceof Error && (error.name === "AbortError" || /timed? out/.test(lower))) {
    return {
      code: "PROVIDER_TIMEOUT",
      message,
      retryable: AI_ERROR_POLICY.PROVIDER_TIMEOUT.retryable,
    };
  }

  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return {
      code: "PROVIDER_RATE_LIMIT",
      message,
      retryable: AI_ERROR_POLICY.PROVIDER_RATE_LIMIT.retryable,
    };
  }

  if (lower.includes("auth") || lower.includes("api key") || lower.includes("unauthorized")) {
    return {
      code: "PROVIDER_AUTH",
      message,
      retryable: AI_ERROR_POLICY.PROVIDER_AUTH.retryable,
    };
  }

  if (lower.includes("bad request") || lower.includes("invalid")) {
    return {
      code: "PROVIDER_BAD_REQUEST",
      message,
      retryable: AI_ERROR_POLICY.PROVIDER_BAD_REQUEST.retryable,
    };
  }

  if (lower.includes("quota")) {
    return {
      code: "QUOTA_EXCEEDED",
      message,
      retryable: AI_ERROR_POLICY.QUOTA_EXCEEDED.retryable,
    };
  }

  if (lower.includes("server error") || lower.includes("internal error")) {
    return {
      code: "PROVIDER_SERVER_ERROR",
      message,
      retryable: AI_ERROR_POLICY.PROVIDER_SERVER_ERROR.retryable,
    };
  }

  return {
    code: "UNKNOWN",
    message,
    retryable: AI_ERROR_POLICY.UNKNOWN.retryable,
  };
}

export function computeRetryDelayMs(code: AiErrorCode, attemptCount: number) {
  const policy = AI_ERROR_POLICY[code];
  if (!("backoff" in policy) || !policy.backoff) {
    return 5_000;
  }

  const base = Math.min(
    policy.backoff.initialDelayMs *
      policy.backoff.multiplier ** Math.max(0, attemptCount - 1),
    policy.backoff.maxDelayMs,
  );

  return Math.floor(Math.random() * base);
}
