import test from "node:test";
import assert from "node:assert/strict";
import {
  IdentityLinkError,
  assertIdentityLinkMayProceed,
  requireLegacyEmail,
} from "./identity-link-policy.ts";

test("an unlinked legacy row can be claimed by the verified Supabase subject", () => {
  assert.equal(assertIdentityLinkMayProceed(null, "subject-a"), "link-required");
  assert.equal(assertIdentityLinkMayProceed(undefined, "subject-a"), "link-required");
});

test("the same verified subject is idempotent", () => {
  assert.equal(assertIdentityLinkMayProceed("subject-a", "subject-a"), "already-linked");
});

test("another verified subject cannot take over an existing Yapp row", () => {
  assert.throws(
    () => assertIdentityLinkMayProceed("subject-a", "subject-b"),
    (error) => error instanceof IdentityLinkError && error.code === "IDENTITY_LINK_CONFLICT",
  );
});

test("phone-only or no-email identities are rejected without synthesizing an email", () => {
  assert.equal(requireLegacyEmail(" User@Example.COM "), "user@example.com");
  assert.throws(
    () => requireLegacyEmail(null),
    (error) => error instanceof IdentityLinkError && error.code === "IDENTITY_EMAIL_REQUIRED",
  );
});
