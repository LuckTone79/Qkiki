import test from "node:test";
import assert from "node:assert/strict";

import {
  buildResultDepthMap,
  partitionResultsForWorkbench,
  pickDisplayFinalResultId,
  prioritizePinnedRootBranches,
  sortResultsForDisplay,
} from "./workbench-results.ts";

function makeResult(overrides = {}) {
  return {
    id: "result-1",
    parentResultId: null,
    status: "completed",
    createdAt: "2026-06-03T00:00:00.000Z",
    updatedAt: "2026-06-03T00:00:00.000Z",
    ...overrides,
  };
}

test("pickDisplayFinalResultId only returns an explicitly completed final result", () => {
  const completed = makeResult({ id: "completed" });
  const failed = makeResult({ id: "failed", status: "failed" });

  assert.equal(
    pickDisplayFinalResultId([completed, failed], "completed"),
    "completed",
  );
  assert.equal(pickDisplayFinalResultId([completed, failed], "failed"), null);
});

test("sortResultsForDisplay keeps sequential results in created order", () => {
  const results = [
    makeResult({ id: "later", createdAt: "2026-06-03T00:00:02.000Z" }),
    makeResult({ id: "earlier", createdAt: "2026-06-03T00:00:01.000Z" }),
  ];

  assert.deepEqual(
    sortResultsForDisplay(results, "sequential").map((result) => result.id),
    ["earlier", "later"],
  );
});

test("sortResultsForDisplay keeps each parallel branch attached to its root", () => {
  const rootA = makeResult({
    id: "root-a",
    updatedAt: "2026-06-03T00:00:03.000Z",
  });
  const childA = makeResult({
    id: "child-a",
    parentResultId: "root-a",
    createdAt: "2026-06-03T00:00:04.000Z",
    updatedAt: "2026-06-03T00:00:04.000Z",
  });
  const rootB = makeResult({
    id: "root-b",
    updatedAt: "2026-06-03T00:00:02.000Z",
  });

  assert.deepEqual(
    sortResultsForDisplay([childA, rootB, rootA], "parallel").map(
      (result) => result.id,
    ),
    ["root-a", "child-a", "root-b"],
  );
});

test("prioritizePinnedRootBranches moves the whole pinned branch together", () => {
  const rootA = makeResult({ id: "root-a" });
  const childA = makeResult({
    id: "child-a",
    parentResultId: "root-a",
    createdAt: "2026-06-03T00:00:01.000Z",
    updatedAt: "2026-06-03T00:00:01.000Z",
  });
  const rootB = makeResult({
    id: "root-b",
    createdAt: "2026-06-03T00:00:02.000Z",
    updatedAt: "2026-06-03T00:00:02.000Z",
  });

  assert.deepEqual(
    prioritizePinnedRootBranches([rootB, rootA, childA], ["child-a"]).map(
      (result) => result.id,
    ),
    ["root-a", "child-a", "root-b"],
  );
});

test("buildResultDepthMap reports nested follow-up depth", () => {
  const root = makeResult({ id: "root" });
  const child = makeResult({ id: "child", parentResultId: "root" });
  const grandchild = makeResult({
    id: "grandchild",
    parentResultId: "child",
  });

  const depthMap = buildResultDepthMap([root, child, grandchild]);

  assert.equal(depthMap.get("root"), 0);
  assert.equal(depthMap.get("child"), 1);
  assert.equal(depthMap.get("grandchild"), 2);
});

test("partitionResultsForWorkbench separates main workflow results from branches", () => {
  const root = makeResult({ id: "root" });
  const branch = makeResult({ id: "branch", parentResultId: "root" });

  assert.deepEqual(partitionResultsForWorkbench([root, branch]), {
    mainResults: [root],
    branchResults: [branch],
  });
});
