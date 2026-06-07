import test from "node:test";
import assert from "node:assert/strict";

import {
  createParallelComparisonPanelState,
  openDetachedParallelComparisonPanel,
  toggleParallelComparisonPanelCollapsed,
} from "./workbench-parallel-comparison-panel.ts";

test("parallel comparison panel starts expanded in the inline card", () => {
  assert.deepEqual(createParallelComparisonPanelState(), {
    collapsed: false,
    detached: false,
  });
});

test("parallel comparison panel toggle only flips collapsed state", () => {
  assert.deepEqual(
    toggleParallelComparisonPanelCollapsed({
      collapsed: false,
      detached: false,
    }),
    {
      collapsed: true,
      detached: false,
    },
  );
});

test("opening detached view re-expands the comparison content", () => {
  assert.deepEqual(
    openDetachedParallelComparisonPanel({
      collapsed: true,
      detached: false,
    }),
    {
      collapsed: false,
      detached: true,
    },
  );
});
