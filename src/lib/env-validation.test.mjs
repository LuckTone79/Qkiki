import test from "node:test";
import assert from "node:assert/strict";
import { collectEnvIssues } from "./env-validation.ts";

const strong = "K4v9pQ2xT7mN5rL8cW3zB6yH1sD0fJ9uA7eG2iP5";
const valid = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://user:password@db.invalid/app",
  APP_SECRET: strong,
  DB_ENCRYPTION_KEY: `${strong}different`,
  ADMIN_TOTP_SECRET: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "token",
  INTERNAL_WORKER_SECRET: `${strong}worker`,
  APP_BASE_URL: "https://yapp.wideget.net",
  CANONICAL_APP_URL: "https://yapp.wideget.net",
};

test("launch configuration accepts independent strong secrets", () => {
  assert.deepEqual(collectEnvIssues(valid), []);
});

test("weak, reused, static-MFA and untrusted-origin settings are fatal", () => {
  const issues = collectEnvIssues({
    ...valid,
    APP_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    DB_ENCRYPTION_KEY: "a",
    ADMIN_MFA_CODE: "123456",
    CANONICAL_APP_URL: "https://evil.example",
  });
  assert.ok(issues.length >= 4);
  assert.ok(issues.every((issue) => issue.level === "fatal"));
});
