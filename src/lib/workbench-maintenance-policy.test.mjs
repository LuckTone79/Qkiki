import test from "node:test";
import assert from "node:assert/strict";

import {
  shouldRunLegacyWorkbenchSchemaRepair,
  shouldRunRequestStaleCleanup,
} from "./workbench-maintenance-policy.ts";

test("legacy workbench schema repair is disabled by default", () => {
  assert.equal(shouldRunLegacyWorkbenchSchemaRepair({}), false);
  assert.equal(
    shouldRunLegacyWorkbenchSchemaRepair({ LEGACY_WORKBENCH_SCHEMA_REPAIR: "true" }),
    false,
  );
});

test("legacy workbench schema repair only runs behind the emergency flag", () => {
  assert.equal(
    shouldRunLegacyWorkbenchSchemaRepair({ LEGACY_WORKBENCH_SCHEMA_REPAIR: "1" }),
    true,
  );
});

test("request stale cleanup is disabled by default", () => {
  assert.equal(shouldRunRequestStaleCleanup({}), false);
});

test("request stale cleanup only runs behind the legacy request flag", () => {
  assert.equal(
    shouldRunRequestStaleCleanup({ LEGACY_WORKBENCH_REQUEST_STALE_CLEANUP: "1" }),
    true,
  );
});
