import test from "node:test";
import assert from "node:assert/strict";

import { shouldShowAuthEntryPoints } from "./trial-user.ts";

test("trial users still see sign-in entry points in the UI", () => {
  assert.equal(
    shouldShowAuthEntryPoints({
      email: "trial-abc123@trial.local",
      isTrial: true,
    }),
    true,
  );
});

test("regular signed-in users keep the signed-in account UI", () => {
  assert.equal(
    shouldShowAuthEntryPoints({
      email: "member@example.com",
      isTrial: false,
    }),
    false,
  );
});
