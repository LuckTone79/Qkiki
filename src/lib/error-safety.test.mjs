import test from "node:test";
import assert from "node:assert/strict";

import {
  getPublicFailureMessage,
  redactSensitiveText,
  sanitizeForLog,
  sanitizePublicWorkbenchPayload,
} from "./error-safety.ts";

test("log redaction removes env literals, credentials, headers, cookies, and query tokens", () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousApiToken = process.env.TEST_API_TOKEN;
  process.env.DATABASE_URL = "postgresql://launch_user:launch_password@db.example.test/yapp";
  process.env.TEST_API_TOKEN = "launch-token-value-123456";

  try {
    const input = [
      process.env.DATABASE_URL,
      "Authorization: Bearer bearer-value-123456",
      "Cookie: yapp_session=cookie-value-123456; theme=dark",
      "https://example.test/callback?code=oauth-code-123&state=oauth-state-456",
      "token=launch-token-value-123456",
    ].join("\n");
    const redacted = redactSensitiveText(input);

    assert.equal(redacted.includes("launch_password"), false);
    assert.equal(redacted.includes("launch-token-value-123456"), false);
    assert.equal(redacted.includes("bearer-value-123456"), false);
    assert.equal(redacted.includes("cookie-value-123456"), false);
    assert.equal(redacted.includes("oauth-code-123"), false);
    assert.equal(redacted.includes("oauth-state-456"), false);
    assert.match(redacted, /\[REDACTED\]/);
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousApiToken === undefined) delete process.env.TEST_API_TOKEN;
    else process.env.TEST_API_TOKEN = previousApiToken;
  }
});

test("structured log sanitization handles nested errors and sensitive keys", () => {
  const secret = "nested-secret-value-123456";
  const previousSecret = process.env.APP_SECRET;
  process.env.APP_SECRET = secret;

  try {
    const sanitized = sanitizeForLog({
      authorization: "Bearer should-never-survive",
      nested: {
        connection: new Error(
          `Connection failed at postgresql://user:password@db.test/app?token=${secret}`,
        ),
      },
    });
    const serialized = JSON.stringify(sanitized);

    assert.equal(serialized.includes(secret), false);
    assert.equal(serialized.includes("should-never-survive"), false);
    assert.equal(serialized.includes("user:password"), false);
  } finally {
    if (previousSecret === undefined) delete process.env.APP_SECRET;
    else process.env.APP_SECRET = previousSecret;
  }
});

test("unexpected public errors use fixed messages instead of raw failures", () => {
  const raw = "Prisma failed for postgresql://user:password@db.test/app";

  assert.equal(getPublicFailureMessage("api"), "Request failed.");
  assert.equal(getPublicFailureMessage("admin-api"), "Admin request failed.");
  assert.equal(getPublicFailureMessage("workbench-run").includes(raw), false);
  assert.equal(getPublicFailureMessage("workbench-stream").includes(raw), false);
});

test("workbench payload mapping removes persisted provider failure details", () => {
  const rawFailure = "provider rejected provider-key-test-secret";
  const publicPayload = sanitizePublicWorkbenchPayload({
    type: "error",
    error: rawFailure,
    executionRun: {
      status: "failed",
      errorMessage: rawFailure,
      streamError: rawFailure,
    },
    runSteps: [
      {
        status: "failed",
        detail: rawFailure,
        errorMessage: rawFailure,
        rawResponse: { error: rawFailure },
      },
    ],
  });
  const serialized = JSON.stringify(publicPayload);

  assert.equal(serialized.includes(rawFailure), false);
  assert.equal(publicPayload.runSteps[0].rawResponse, null);
  assert.equal(
    publicPayload.error,
    getPublicFailureMessage("workbench-stream"),
  );
});
