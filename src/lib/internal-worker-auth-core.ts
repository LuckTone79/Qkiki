import crypto from "node:crypto";

const UNSAFE_SECRET_MARKERS = [
  "change-me",
  "changeme",
  "replace-me",
  "placeholder",
  "dev-only",
  "example",
];

export const INTERNAL_WORKER_MAX_CLOCK_SKEW_MS = 60_000;

export function isStrongInternalWorkerSecret(value: string | undefined) {
  const secret = value?.trim() ?? "";
  if (Buffer.byteLength(secret, "utf8") < 32) {
    return false;
  }

  const lower = secret.toLowerCase();
  return !UNSAFE_SECRET_MARKERS.some((marker) => lower.includes(marker));
}

export function requiresQstashOnlyVerification(input: {
  nodeEnv: string | undefined;
  currentSigningKey: string | undefined;
  nextSigningKey: string | undefined;
}) {
  return (
    input.nodeEnv === "production" &&
    Boolean(input.currentSigningKey?.trim() || input.nextSigningKey?.trim())
  );
}

export function isFreshInternalWorkerTimestamp(
  value: string,
  now = Date.now(),
) {
  if (!/^\d{10,16}$/.test(value)) {
    return false;
  }

  const timestamp = Number(value);
  return (
    Number.isSafeInteger(timestamp) &&
    Math.abs(now - timestamp) <= INTERNAL_WORKER_MAX_CLOCK_SKEW_MS
  );
}

export function buildInternalWorkerSignature(input: {
  secret: string;
  timestamp: string;
  method: string;
  path: string;
  body: string;
}) {
  const bodyHash = crypto.createHash("sha256").update(input.body).digest("hex");
  const payload = [
    input.timestamp,
    input.method.toUpperCase(),
    input.path,
    bodyHash,
  ].join(".");

  return crypto.createHmac("sha256", input.secret).update(payload).digest("hex");
}

export function timingSafeSignatureEqual(expected: string, actual: string) {
  if (!/^[a-f0-9]{64}$/i.test(expected) || !/^[a-f0-9]{64}$/i.test(actual)) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(actual, "hex");
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}
