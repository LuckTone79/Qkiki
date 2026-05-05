import "server-only";

import crypto from "crypto";

export const GOOGLE_OAUTH_PROVIDER = "google";
export const GOOGLE_OAUTH_STATE_COOKIE = "qkiki_google_oauth_state";
export const DEFAULT_POST_AUTH_PATH = "/app/workbench";

const GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;

type GoogleOAuthStatePayload = {
  state: string;
  nextPath: string;
  expiresAt: number;
};

function getAppSecret() {
  const secret = process.env.APP_SECRET?.trim();
  if (!secret) {
    throw new Error("APP_SECRET must be configured.");
  }
  return secret;
}

function toBase64Url(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromBase64Url(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signEncodedPayload(encodedPayload: string) {
  return crypto
    .createHmac("sha256", getAppSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function sanitizePostAuthPath(candidate: string | null | undefined) {
  if (!candidate) {
    return DEFAULT_POST_AUTH_PATH;
  }
  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return DEFAULT_POST_AUTH_PATH;
  }
  if (!candidate.startsWith("/app")) {
    return DEFAULT_POST_AUTH_PATH;
  }
  return candidate;
}

export function getGoogleOAuthConfig(requestUrl: string) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return null;
  }

  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ||
    new URL("/api/auth/google/callback", requestUrl).toString();

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

export function createGoogleOAuthState(nextPath: string) {
  const state = crypto.randomBytes(24).toString("base64url");
  const payload: GoogleOAuthStatePayload = {
    state,
    nextPath: sanitizePostAuthPath(nextPath),
    expiresAt: Date.now() + GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS * 1000,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signEncodedPayload(encodedPayload);

  return {
    state,
    token: `${encodedPayload}.${signature}`,
    maxAgeSeconds: GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS,
  };
}

export function validateGoogleOAuthState(
  token: string | null | undefined,
  receivedState: string | null,
) {
  if (!token || !receivedState) {
    return null;
  }

  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex <= 0) {
    return null;
  }

  const encodedPayload = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  const expected = signEncodedPayload(encodedPayload);

  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  let payload: GoogleOAuthStatePayload | null = null;
  try {
    payload = JSON.parse(fromBase64Url(encodedPayload)) as GoogleOAuthStatePayload;
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }
  if (payload.state !== receivedState) {
    return null;
  }
  if (typeof payload.expiresAt !== "number" || payload.expiresAt < Date.now()) {
    return null;
  }

  return {
    nextPath: sanitizePostAuthPath(payload.nextPath),
  };
}
