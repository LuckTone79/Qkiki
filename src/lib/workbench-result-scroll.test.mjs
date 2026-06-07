import test from "node:test";
import assert from "node:assert/strict";

import { resolveResultStartTarget } from "./workbench-result-scroll.ts";

test("result start target prefers the currently viewed visible result", () => {
  assert.equal(
    resolveResultStartTarget({
      activeResultId: "result-b",
      visibleResultIds: ["result-a", "result-b", "result-c"],
    }),
    "result-b",
  );
});

test("result start target falls back to the first visible result", () => {
  assert.equal(
    resolveResultStartTarget({
      activeResultId: "hidden-result",
      visibleResultIds: ["result-a", "result-b"],
    }),
    "result-a",
  );
});

test("result start target is null when there are no visible results", () => {
  assert.equal(
    resolveResultStartTarget({
      activeResultId: "result-a",
      visibleResultIds: [],
    }),
    null,
  );
});
