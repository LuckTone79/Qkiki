import test from "node:test";
import assert from "node:assert/strict";

import {
  buildNewWorkbenchPath,
  buildSharedResultPath,
  buildSharedSessionPath,
  buildWorkbenchMobilePanels,
} from "./workbench-sharing.ts";

test("buildNewWorkbenchPath creates an explicit fresh workbench URL", () => {
  assert.equal(buildNewWorkbenchPath(), "/app/workbench?new=1");
});

test("buildSharedSessionPath creates the public session URL", () => {
  assert.equal(buildSharedSessionPath("share_token"), "/shared/share_token");
});

test("buildSharedResultPath focuses the requested result", () => {
  assert.equal(
    buildSharedResultPath("share_token", "result_123"),
    "/shared/share_token?result=result_123",
  );
});

test("sequential mobile panels place workflow between input and results", () => {
  assert.deepEqual(
    buildWorkbenchMobilePanels({ mode: "sequential", resultsCount: 2 }).map(
      (panel) => panel.id,
    ),
    ["input", "workflow", "results"],
  );
});

test("parallel mobile panels keep models before input and results", () => {
  assert.deepEqual(
    buildWorkbenchMobilePanels({ mode: "parallel", resultsCount: 0 }).map(
      (panel) => panel.id,
    ),
    ["models", "input", "results"],
  );
});
