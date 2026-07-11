import test from "node:test";
import assert from "node:assert/strict";

import {
  sanitizeAdminAccessReasonCode,
  sanitizeAdminAuditDetail,
  sanitizeStoredAdminAuditDetailJson,
} from "./admin-audit-sanitizer.ts";

test("admin audit details redact coupon codes and nested credentials", () => {
  assert.deepEqual(
    sanitizeAdminAuditDetail({
      code: "LIFETIME-SECRET-CODE",
      nested: {
        apiKey: "provider-key-test-value",
        status: "ready",
      },
      type: "UNLIMITED_LIFETIME",
    }),
    {
      code: "[REDACTED]",
      nested: {
        apiKey: "[REDACTED]",
        status: "ready",
      },
      type: "UNLIMITED_LIFETIME",
    },
  );
});

test("historical audit JSON is sanitized before it is returned", () => {
  const sanitized = sanitizeStoredAdminAuditDetailJson(
    JSON.stringify({
      couponCode: "OLD-LIVE-CODE",
      callback: "https://example.test/cb?token=secret-value&ok=1",
    }),
  );

  assert.equal(
    sanitized,
    JSON.stringify({
      couponCode: "[REDACTED]",
      callback: "https://example.test/cb?token=[REDACTED]&ok=1",
    }),
  );
  assert.equal(sanitizeStoredAdminAuditDetailJson("not-json"), null);
});

test("content access reasons are restricted to non-secret reason codes", () => {
  assert.equal(
    sanitizeAdminAccessReasonCode("support_investigation"),
    "support_investigation",
  );
  assert.equal(sanitizeAdminAccessReasonCode("token=do-not-store"), "other");
});
