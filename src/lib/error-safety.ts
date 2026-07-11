const REDACTED = "[REDACTED]";
const MAX_LOG_DEPTH = 6;
const MAX_LOG_ARRAY_ITEMS = 50;
const MAX_LOG_OBJECT_KEYS = 100;

const SENSITIVE_NAME_PATTERN =
  /(?:authorization|proxy[-_]?authorization|cookie|set[-_]?cookie|password|passwd|secret|token|api[-_]?key|client[-_]?secret|private[-_]?key|credential|signature|session|database[-_]?url|direct[-_]?url|dsn)/i;

const SENSITIVE_ENV_NAME_PATTERN =
  /(?:password|passwd|secret|token|key|credential|signature|database_url|direct_url|postgres|dsn|authorization|cookie)/i;

const PUBLIC_FAILURE_MESSAGES = {
  api: "Request failed.",
  "admin-api": "Admin request failed.",
  "workbench-run": "The AI run could not be completed.",
  "workbench-step": "This AI step could not be completed.",
  "workbench-stream": "The AI run stream could not be completed.",
} as const;

export type PublicFailureKind = keyof typeof PUBLIC_FAILURE_MESSAGES;

function getSensitiveEnvironmentValues() {
  return Object.entries(process.env)
    .filter(
      ([name, value]) =>
        SENSITIVE_ENV_NAME_PATTERN.test(name) &&
        typeof value === "string" &&
        value.length >= 4,
    )
    .flatMap(([, value]) => {
      const encoded = encodeURIComponent(value as string);
      return encoded === value ? [value as string] : [value as string, encoded];
    })
    .sort((left, right) => right.length - left.length);
}

export function redactSensitiveText(input: string) {
  let output = input;

  for (const secret of getSensitiveEnvironmentValues()) {
    output = output.replaceAll(secret, REDACTED);
  }

  return output
    .replace(
      /([a-z][a-z0-9+.-]*:\/\/)(?:[^/\s:@]+(?::[^@/\s]*)?@)/gi,
      `$1${REDACTED}@`,
    )
    .replace(
      /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi,
      REDACTED,
    )
    .replace(
      /((?:authorization|proxy-authorization|cookie|set-cookie)\s*[:=]\s*)[^\r\n]+/gi,
      `$1${REDACTED}`,
    )
    .replace(
      /([?&](?:access_token|refresh_token|id_token|token|api_?key|key|secret|password|code|state|signature|credential|session)=)[^&#\s]*/gi,
      `$1${REDACTED}`,
    )
    .replace(
      /((?:^|[\s,{])(?:authorization|cookie|password|passwd|secret|token|api[-_]?key|client[-_]?secret|private[-_]?key|credential|signature|session)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^,\s}\]]+)/gi,
      `$1${REDACTED}`,
    )
    .replace(
      /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g,
      REDACTED,
    )
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, REDACTED)
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, REDACTED)
    .replace(/\bAIza[A-Za-z0-9_-]{20,}\b/g, REDACTED)
    .replace(/\b(?:gh[oprsu]_|xox[baprs]-)[A-Za-z0-9_-]{12,}\b/g, REDACTED);
}

function sanitizeObject(
  value: object,
  seen: WeakSet<object>,
  depth: number,
): unknown {
  if (seen.has(value)) {
    return "[CIRCULAR]";
  }
  if (depth >= MAX_LOG_DEPTH) {
    return "[MAX_DEPTH]";
  }

  seen.add(value);

  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof URL) {
    return redactSensitiveText(value.toString());
  }
  if (value instanceof Error) {
    const errorWithDetails = value as Error & {
      cause?: unknown;
      code?: unknown;
    };
    return {
      name: redactSensitiveText(value.name),
      message: redactSensitiveText(value.message),
      stack: value.stack ? redactSensitiveText(value.stack) : undefined,
      code: sanitizeLogValue(errorWithDetails.code, seen, depth + 1),
      cause: sanitizeLogValue(errorWithDetails.cause, seen, depth + 1),
    };
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_LOG_ARRAY_ITEMS)
      .map((item) => sanitizeLogValue(item, seen, depth + 1));
  }
  if (value instanceof Headers) {
    return Object.fromEntries(
      Array.from(value.entries()).map(([name, headerValue]) => [
        name,
        SENSITIVE_NAME_PATTERN.test(name)
          ? REDACTED
          : redactSensitiveText(headerValue),
      ]),
    );
  }

  const sanitized: Record<string, unknown> = {};
  let entries: [string, unknown][];
  try {
    entries = Object.entries(value as Record<string, unknown>).slice(
      0,
      MAX_LOG_OBJECT_KEYS,
    );
  } catch {
    return "[UNREADABLE_OBJECT]";
  }

  for (const [name, entryValue] of entries) {
    sanitized[name] = SENSITIVE_NAME_PATTERN.test(name)
      ? REDACTED
      : sanitizeLogValue(entryValue, seen, depth + 1);
  }
  return sanitized;
}

function sanitizeLogValue(
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
): unknown {
  if (typeof value === "string") {
    return redactSensitiveText(value);
  }
  if (
    value === null ||
    value === undefined ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return value;
  }
  if (typeof value === "symbol" || typeof value === "function") {
    return `[${(typeof value).toUpperCase()}]`;
  }
  return sanitizeObject(value, seen, depth);
}

export function sanitizeForLog(value: unknown) {
  try {
    return sanitizeLogValue(value, new WeakSet<object>(), 0);
  } catch {
    return "[LOG_SANITIZATION_FAILED]";
  }
}

export function secureLogError(
  event: string,
  error: unknown,
  context?: Record<string, unknown>,
) {
  console.error("[secure-error]", {
    event: redactSensitiveText(event),
    error: sanitizeForLog(error),
    ...(context ? { context: sanitizeForLog(context) } : {}),
  });
}

export function getPublicFailureMessage(kind: PublicFailureKind) {
  return PUBLIC_FAILURE_MESSAGES[kind];
}

function sanitizeWorkbenchValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeWorkbenchValue);
  }
  if (
    value === null ||
    typeof value !== "object" ||
    value instanceof Date
  ) {
    return value;
  }

  const source = value as Record<string, unknown>;
  const failed = source.status === "failed";
  const sanitized: Record<string, unknown> = {};

  for (const [key, entryValue] of Object.entries(source)) {
    if (key === "errorMessage" && entryValue) {
      sanitized[key] = getPublicFailureMessage("workbench-step");
    } else if (key === "streamError" && entryValue) {
      sanitized[key] = getPublicFailureMessage("workbench-run");
    } else if (key === "error" && source.type === "error" && entryValue) {
      sanitized[key] = getPublicFailureMessage("workbench-stream");
    } else if (key === "detail" && entryValue) {
      sanitized[key] = getPublicFailureMessage("workbench-step");
    } else if (key === "rawResponse" && failed) {
      sanitized[key] = null;
    } else {
      sanitized[key] = sanitizeWorkbenchValue(entryValue);
    }
  }

  return sanitized;
}

export function sanitizePublicWorkbenchPayload<T>(value: T): T {
  return sanitizeWorkbenchValue(value) as T;
}
