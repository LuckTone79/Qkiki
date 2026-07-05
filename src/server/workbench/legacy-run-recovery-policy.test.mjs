import test from "node:test";
import assert from "node:assert/strict";

import {
  getLegacyRunStaleSeconds,
  shouldRecoverLegacyRun,
} from "./legacy-run-recovery-policy.ts";

test("legacy stale threshold keeps safe bounds", () => {
  assert.equal(getLegacyRunStaleSeconds({}), 1800);
  assert.equal(getLegacyRunStaleSeconds({ WORKBENCH_STALE_RUN_SECONDS: "120" }), 1800);
  assert.equal(getLegacyRunStaleSeconds({ WORKBENCH_STALE_RUN_SECONDS: "900" }), 900);
});

test("only stale active V1 runs trigger targeted recovery", () => {
  const now = new Date("2026-07-06T12:00:00.000Z");
  const stale = new Date("2026-07-06T11:20:00.000Z");

  assert.equal(
    shouldRecoverLegacyRun(
      { runnerVersion: "v1", status: "running", updatedAt: stale },
      now,
      {},
    ),
    true,
  );
  assert.equal(
    shouldRecoverLegacyRun(
      { runnerVersion: "v2", status: "running", updatedAt: stale },
      now,
      {},
    ),
    false,
  );
  assert.equal(
    shouldRecoverLegacyRun(
      { runnerVersion: "v1", status: "completed", updatedAt: stale },
      now,
      {},
    ),
    false,
  );
  assert.equal(
    shouldRecoverLegacyRun(
      {
        runnerVersion: "v1",
        status: "running",
        updatedAt: new Date("2026-07-06T11:59:00.000Z"),
      },
      now,
      {},
    ),
    false,
  );
});
