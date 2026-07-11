const REDACTED = "[REDACTED]";
const MAX_AUDIT_STRING_LENGTH = 2_000;
const MAX_AUDIT_ARRAY_LENGTH = 100;
const MAX_AUDIT_DEPTH = 8;
const ALLOWED_ACCESS_REASON_CODES = new Set([
  "abuse_review",
  "detail_open",
  "raw_view",
  "support_investigation",
  "user_request",
]);

const SENSITIVE_FIELD_NAMES = new Set([
  "authorization",
  "ciphertext",
  "clientsecret",
  "code",
  "cookie",
  "couponcode",
  "credential",
  "dbpassword",
  "encryptionkey",
  "idtoken",
  "iv",
  "key",
  "mfacode",
  "otp",
  "password",
  "passwordhash",
  "refreshtoken",
  "secret",
  "sessiontoken",
  "tag",
  "token",
  "totp",
]);

function normalizedFieldName(fieldName: string) {
  return fieldName.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSensitiveFieldName(fieldName: string) {
  const normalized = normalizedFieldName(fieldName);

  return (
    SENSITIVE_FIELD_NAMES.has(normalized) ||
    normalized.endsWith("apikey") ||
    normalized.endsWith("authorization") ||
    normalized.endsWith("cookie") ||
    normalized.endsWith("couponcode") ||
    normalized.endsWith("password") ||
    normalized.endsWith("secret") ||
    normalized.endsWith("token")
  );
}

export function sanitizeAdminAuditText(value: string) {
  return value
    .slice(0, MAX_AUDIT_STRING_LENGTH)
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, `Bearer ${REDACTED}`)
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, REDACTED)
    .replace(/\bAIza[A-Za-z0-9_-]{20,}\b/g, REDACTED)
    .replace(
      /([?&](?:access_token|api_key|apikey|authorization|code|key|password|secret|token)=)[^&#\s]*/gi,
      `$1${REDACTED}`,
    );
}

export function sanitizeAdminAccessReasonCode(value: string) {
  return ALLOWED_ACCESS_REASON_CODES.has(value) ? value : "other";
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > MAX_AUDIT_DEPTH) {
    return "[TRUNCATED]";
  }

  if (typeof value === "string") {
    return sanitizeAdminAuditText(value);
  }

  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_AUDIT_ARRAY_LENGTH)
      .map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        isSensitiveFieldName(key)
          ? REDACTED
          : sanitizeValue(nestedValue, depth + 1),
      ]),
    );
  }

  return String(value).slice(0, MAX_AUDIT_STRING_LENGTH);
}

export function sanitizeAdminAuditDetail(
  detail: Record<string, unknown>,
): Record<string, unknown> {
  return sanitizeValue(detail, 0) as Record<string, unknown>;
}

export function serializeAdminAuditDetail(
  detail: Record<string, unknown> | undefined,
) {
  return detail ? JSON.stringify(sanitizeAdminAuditDetail(detail)) : null;
}

/**
 * Historical rows may predate the write-time sanitizer. Never return their
 * raw JSON string; parse and sanitize it first, or suppress malformed data.
 */
export function sanitizeStoredAdminAuditDetailJson(detailJson: string | null) {
  if (!detailJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(detailJson) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    return JSON.stringify(
      sanitizeAdminAuditDetail(parsed as Record<string, unknown>),
    );
  } catch {
    return null;
  }
}
