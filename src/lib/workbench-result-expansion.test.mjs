import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCollapsedResultExpansionMap,
  mergeResultExpansionMap,
  setAllResultsExpanded,
} from "./workbench-result-expansion.ts";

function makeResult(id) {
  return { id };
}

test("buildCollapsedResultExpansionMap initializes every result as collapsed", () => {
  assert.deepEqual(buildCollapsedResultExpansionMap([makeResult("a"), makeResult("b")]), {
    a: false,
    b: false,
  });
});

test("mergeResultExpansionMap preserves known values and collapses new results", () => {
  assert.deepEqual(
    mergeResultExpansionMap(
      {
        a: true,
        b: false,
        orphan: true,
      },
      [makeResult("a"), makeResult("c")],
    ),
    {
      a: true,
      c: false,
    },
  );
});

test("setAllResultsExpanded can expand or collapse every rendered result", () => {
  assert.deepEqual(setAllResultsExpanded([makeResult("a"), makeResult("b")], true), {
    a: true,
    b: true,
  });
  assert.deepEqual(setAllResultsExpanded([makeResult("a"), makeResult("b")], false), {
    a: false,
    b: false,
  });
});
