import test from "node:test";
import assert from "node:assert/strict";

import {
  buildV2SourcePromptBlocks,
  classifySourceContextKind,
  isPriorSourceContextKind,
  requireUsableCompletedSource,
  resolveSourceContext,
} from "./source-context.ts";

test("source-context classification distinguishes original and prior modes", () => {
  assert.equal(
    classifySourceContextKind({
      sourceMode: "original",
      hasUsablePriorSource: false,
      completedSourceCount: 0,
    }),
    "original",
  );

  assert.equal(
    classifySourceContextKind({
      sourceMode: "previous",
      hasUsablePriorSource: true,
      completedSourceCount: 1,
    }),
    "prior_result",
  );

  assert.equal(
    classifySourceContextKind({
      sourceMode: "selected_result",
      hasUsablePriorSource: true,
      completedSourceCount: 1,
    }),
    "prior_result",
  );

  assert.equal(
    classifySourceContextKind({
      sourceMode: "all_results",
      hasUsablePriorSource: true,
      completedSourceCount: 1,
    }),
    "prior_results",
  );

  assert.equal(
    classifySourceContextKind({
      sourceMode: "all_results",
      hasUsablePriorSource: false,
      completedSourceCount: 0,
    }),
    "original_fallback",
  );

  assert.equal(
    classifySourceContextKind({
      sourceMode: "branch",
      hasUsablePriorSource: true,
      completedSourceCount: 1,
    }),
    "prior_result",
  );
});

test("isPriorSourceContextKind only returns true for real prior continuity", () => {
  assert.equal(isPriorSourceContextKind("original"), false);
  assert.equal(isPriorSourceContextKind("original_fallback"), false);
  assert.equal(isPriorSourceContextKind("prior_result"), true);
  assert.equal(isPriorSourceContextKind("prior_results"), true);
});

test("resolveSourceContext returns original fallback when previous source is unavailable", () => {
  const context = resolveSourceContext({
    sourceMode: "previous",
    priorText: null,
    fallbackText: "Start from the original task.",
  });

  assert.equal(context.kind, "original_fallback");
  assert.equal(context.text, "Start from the original task.");
  assert.equal(context.segments, undefined);
});

test("resolveSourceContext throws when selected_result is missing or unusable", () => {
  assert.throws(
    () =>
      resolveSourceContext({
        sourceMode: "selected_result",
        priorText: "   ",
        fallbackText: "Do not use this fallback silently.",
      }),
    /selected_result requires a usable completed source/i,
  );
});

test("resolveSourceContext throws when branch source is missing instead of silently falling back", () => {
  assert.throws(
    () =>
      resolveSourceContext({
        sourceMode: "branch",
        priorText: "   ",
        fallbackText: "Do not continue from this fallback.",
        originalText: "Original task",
      }),
    /branch requires a usable completed source/i,
  );
});

test("requireUsableCompletedSource rejects failed and queued sources", () => {
  assert.throws(
    () =>
      requireUsableCompletedSource(
        { status: "failed", outputText: "Finished output" },
        "selected_result",
      ),
    /selected_result requires a completed source/i,
  );

  assert.throws(
    () =>
      requireUsableCompletedSource(
        { status: "queued", outputText: "Still waiting" },
        "branch",
      ),
    /branch requires a completed source/i,
  );
});

test("requireUsableCompletedSource rejects completed sources without usable output", () => {
  assert.throws(
    () =>
      requireUsableCompletedSource(
        { status: "completed", outputText: "   " },
        "selected_result",
      ),
    /selected_result requires a completed source with non-empty output/i,
  );
});

test("requireUsableCompletedSource returns trimmed text for completed usable sources", () => {
  assert.equal(
    requireUsableCompletedSource(
      { status: "completed", outputText: "  Completed answer.  " },
      "branch",
    ),
    "Completed answer.",
  );
});

test("resolveSourceContext creates ordered prior-result segments for all_results", () => {
  const context = resolveSourceContext({
    sourceMode: "all_results",
    allResultsTexts: ["Old draft", "New handoff"],
    fallbackText: "Original task",
    includeSourceSegments: true,
  });

  assert.equal(context.kind, "prior_results");
  assert.equal(context.segments?.length, 2);
  assert.deepEqual(
    context.segments?.map((segment) => ({
      key: segment.key,
      priority: segment.priority,
      text: segment.text,
    })),
    [
      {
        key: "latest",
        priority: "highest",
        text: "New handoff",
      },
      {
        key: "older",
        priority: "medium",
        text: "Old draft",
      },
    ],
  );
});

test("v2 source blocks preserve the latest prior result as highest and protect it", () => {
  const context = resolveSourceContext({
    sourceMode: "all_results",
    allResultsTexts: ["Oldest handoff", "Newer handoff", "Latest handoff"],
    fallbackText: "Original task",
    includeSourceSegments: true,
  });

  const blocks = buildV2SourcePromptBlocks({
    sourceContext: context,
    defaultPriority: "low",
  });

  assert.deepEqual(blocks, [
    {
      key: "source-latest",
      priority: "highest",
      protected: true,
      sourceContextKind: "prior_result",
      text: "Latest handoff",
    },
    {
      key: "source-older",
      priority: "medium",
      protected: false,
      sourceContextKind: "prior_results",
      text: "Newer handoff\n\nOldest handoff",
    },
  ]);
});
