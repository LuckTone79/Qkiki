import test from "node:test";
import assert from "node:assert/strict";

import {
  getAssuredWorkbenchSchemaCapabilities,
  isLegacyWorkbenchSchemaRepairEnabled,
} from "./schema-compat-policy.ts";

test("legacy runtime schema repair is disabled unless explicitly enabled", () => {
  assert.equal(isLegacyWorkbenchSchemaRepairEnabled({}), false);
  assert.equal(
    isLegacyWorkbenchSchemaRepairEnabled({ LEGACY_WORKBENCH_SCHEMA_REPAIR: "0" }),
    false,
  );
  assert.equal(
    isLegacyWorkbenchSchemaRepairEnabled({ LEGACY_WORKBENCH_SCHEMA_REPAIR: "1" }),
    true,
  );
});

test("migrated deployments expose all required workbench capabilities", () => {
  assert.deepEqual(getAssuredWorkbenchSchemaCapabilities(), {
    supportsStepControl: true,
    supportsRunScopedResults: true,
    supportsRunExecutionOrder: true,
  });
});
