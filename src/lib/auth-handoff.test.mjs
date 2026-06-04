import test from "node:test";
import assert from "node:assert/strict";
import {
  createAuthHandoffToken,
  readAuthHandoffToken,
  sanitizeInternalReturnPath,
} from "./auth-handoff.ts";

test("sanitizeInternalReturnPath keeps safe internal paths", () => {
  assert.equal(sanitizeInternalReturnPath("/app/workbench?trial=true"), "/app/workbench?trial=true");
  assert.equal(sanitizeInternalReturnPath("/"), "/");
});

test("sanitizeInternalReturnPath rejects external or malformed targets", () => {
  assert.equal(sanitizeInternalReturnPath("https://example.com"), "/app/workbench");
  assert.equal(sanitizeInternalReturnPath("//evil.example"), "/app/workbench");
});

test("auth handoff token round-trips the payload", () => {
  const token = createAuthHandoffToken(
    {
      sessionTokenHash: "hash_123",
      userId: "user_123",
      nextPath: "/guide",
    },
    { secret: "test-secret", now: 1000, ttlMs: 60_000 },
  );

  const payload = readAuthHandoffToken(token, {
    secret: "test-secret",
    now: 10_000,
  });

  assert.deepEqual(payload, {
    sessionTokenHash: "hash_123",
    userId: "user_123",
    nextPath: "/guide",
  });
});

test("auth handoff token rejects tampering and expiry", () => {
  const token = createAuthHandoffToken(
    {
      sessionTokenHash: "hash_123",
      userId: "user_123",
      nextPath: "/",
    },
    { secret: "test-secret", now: 1000, ttlMs: 1000 },
  );

  assert.equal(
    readAuthHandoffToken(`${token}x`, { secret: "test-secret", now: 1500 }),
    null,
  );
  assert.equal(
    readAuthHandoffToken(token, { secret: "test-secret", now: 5000 }),
    null,
  );
});
