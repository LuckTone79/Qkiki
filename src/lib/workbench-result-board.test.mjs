import test from "node:test";
import assert from "node:assert/strict";

import { buildResultBoardView } from "./workbench-result-board.ts";

function makeResult(overrides = {}) {
  return {
    id: "result-1",
    parentResultId: null,
    status: "completed",
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
    provider: "openai",
    model: "gpt-5.4-mini",
    outputText: "alpha",
    errorMessage: null,
    ...overrides,
  };
}

test("buildResultBoardView keeps workflow order when sort is workflow", () => {
  const ordered = [
    makeResult({ id: "first" }),
    makeResult({ id: "second", createdAt: "2026-06-04T00:00:01.000Z" }),
  ];

  assert.deepEqual(
    buildResultBoardView(ordered, {
      filter: "all",
      sort: "workflow",
      query: "",
    }).map((result) => result.id),
    ["first", "second"],
  );
});

test("buildResultBoardView filters final, main, and branch results", () => {
  const root = makeResult({ id: "root" });
  const branch = makeResult({ id: "branch", parentResultId: "root" });

  assert.deepEqual(
    buildResultBoardView([root, branch], {
      filter: "final",
      sort: "workflow",
      query: "",
      finalResultId: "branch",
    }).map((result) => result.id),
    ["branch"],
  );

  assert.deepEqual(
    buildResultBoardView([root, branch], {
      filter: "main",
      sort: "workflow",
      query: "",
    }).map((result) => result.id),
    ["root"],
  );

  assert.deepEqual(
    buildResultBoardView([root, branch], {
      filter: "branch",
      sort: "workflow",
      query: "",
    }).map((result) => result.id),
    ["branch"],
  );
});

test("buildResultBoardView can isolate failed-like results", () => {
  const completed = makeResult({ id: "completed" });
  const failed = makeResult({ id: "failed", status: "failed" });
  const canceled = makeResult({ id: "canceled", status: "canceled" });

  assert.deepEqual(
    buildResultBoardView([completed, failed, canceled], {
      filter: "failed",
      sort: "workflow",
      query: "",
    }).map((result) => result.id),
    ["failed", "canceled"],
  );
});

test("buildResultBoardView applies free-text search across model content", () => {
  const first = makeResult({
    id: "first",
    provider: "anthropic",
    model: "claude-opus-4-8",
    outputText: "Detailed final brief",
  });
  const second = makeResult({
    id: "second",
    provider: "google",
    model: "gemini-2.5-flash",
    outputText: "Quick note",
  });

  assert.deepEqual(
    buildResultBoardView([first, second], {
      filter: "all",
      sort: "workflow",
      query: "opus",
    }).map((result) => result.id),
    ["first"],
  );

  assert.deepEqual(
    buildResultBoardView([first, second], {
      filter: "all",
      sort: "workflow",
      query: "quick",
    }).map((result) => result.id),
    ["second"],
  );
});

test("buildResultBoardView can search extra step tokens", () => {
  const result = makeResult({
    id: "step-result",
    searchTokens: ["step 4", "critique", "template 2"],
  });

  assert.deepEqual(
    buildResultBoardView([result], {
      filter: "all",
      sort: "workflow",
      query: "step 4",
    }).map((item) => item.id),
    ["step-result"],
  );
});

test("buildResultBoardView supports latest and failed-first sorting", () => {
  const early = makeResult({
    id: "early",
    updatedAt: "2026-06-04T00:00:01.000Z",
  });
  const failed = makeResult({
    id: "failed",
    status: "failed",
    updatedAt: "2026-06-04T00:00:02.000Z",
  });
  const latest = makeResult({
    id: "latest",
    updatedAt: "2026-06-04T00:00:03.000Z",
  });

  assert.deepEqual(
    buildResultBoardView([early, failed, latest], {
      filter: "all",
      sort: "latest",
      query: "",
    }).map((result) => result.id),
    ["latest", "failed", "early"],
  );

  assert.deepEqual(
    buildResultBoardView([early, latest, failed], {
      filter: "all",
      sort: "failed_first",
      query: "",
    }).map((result) => result.id),
    ["failed", "latest", "early"],
  );
});
