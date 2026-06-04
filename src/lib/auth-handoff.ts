import crypto from "crypto";

const DEFAULT_NEXT_PATH = "/app/workbench";
const DEFAULT_TTL_MS = 60_000;

type AuthHandoffInput = {
  sessionTokenHash: string;
  userId: string;
  nextPath: string;
};

type SignedPayload = AuthHandoffInput & {
  expiresAt: number;
};

function getSecret(secret?: string) {
  const resolved = secret ?? process.env.APP_SECRET?.trim();
  if (!resolved) {
    throw new Error("APP_SECRET must be configured.");
  }
  return resolved;
}

function toBase64Url(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromBase64Url(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string, secret?: string) {
  return crypto
    .createHmac("sha256", getSecret(secret))
    .update(encodedPayload)
    .digest("base64url");
}

export function sanitizeInternalReturnPath(candidate: string | null | undefined) {
  if (!candidate) {
    return DEFAULT_NEXT_PATH;
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return DEFAULT_NEXT_PATH;
  }

  return candidate;
}

export function createAuthHandoffToken(
  input: AuthHandoffInput,
  options?: { secret?: string; now?: number; ttlMs?: number },
) {
  const payload: SignedPayload = {
    sessionTokenHash: input.sessionTokenHash,
    userId: input.userId,
    nextPath: sanitizeInternalReturnPath(input.nextPath),
    expiresAt: (options?.now ?? Date.now()) + (options?.ttlMs ?? DEFAULT_TTL_MS),
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, options?.secret);
  return `${encodedPayload}.${signature}`;
}

export function readAuthHandoffToken(
  token: string | null | undefined,
  options?: { secret?: string; now?: number },
) {
  if (!token) {
    return null;
  }

  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex <= 0) {
    return null;
  }

  const encodedPayload = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  const expected = signPayload(encodedPayload, options?.secret);
  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  let payload: SignedPayload | null = null;
  try {
    payload = JSON.parse(fromBase64Url(encodedPayload)) as SignedPayload;
  } catch {
    return null;
  }

  if (!payload || payload.expiresAt < (options?.now ?? Date.now())) {
    return null;
  }

  if (!payload.sessionTokenHash || !payload.userId) {
    return null;
  }

  return {
    sessionTokenHash: payload.sessionTokenHash,
    userId: payload.userId,
    nextPath: sanitizeInternalReturnPath(payload.nextPath),
  };
}
