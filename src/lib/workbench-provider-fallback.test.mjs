import test from "node:test";
import assert from "node:assert/strict";

import { shouldAllowConfiguredProviderFallback } from "./workbench-provider-fallback.ts";

test("parallel workbench runs allow the configured provider fallback", () => {
  assert.equal(shouldAllowConfiguredProviderFallback("parallel"), true);
});

test("sequential workbench runs keep provider fallback disabled", () => {
  assert.equal(shouldAllowConfiguredProviderFallback("sequential"), false);
});
