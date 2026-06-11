import test from "node:test";
import assert from "node:assert/strict";

import { composePrompt, getActionLabel, getSourceHeading } from "./prompt.ts";

test("brainstorm action exposes a divergent label", () => {
  const label = getActionLabel("brainstorm");
  assert.match(label, /divergent/i);
});

test("brainstorm prompt injects divergent brainstorming rules", () => {
  const prompt = composePrompt({
    actionType: "brainstorm",
    originalInput: "Plan a community event",
  });

  assert.match(prompt, /Brainstorming rules:/);
  assert.match(prompt, /Think divergently/);
  assert.match(prompt, /at least 5 distinct ideas/i);
  assert.match(prompt, /Threads worth pursuing/);
});

test("brainstorm prompt treats prior ideas as a multi-model discussion to extend", () => {
  const prompt = composePrompt({
    actionType: "brainstorm",
    originalInput: "Plan a community event",
    sourceText: "1. Outdoor movie night\n2. Local food swap",
  });

  assert.match(prompt, /Ideas already on the table from other AI models/);
  assert.match(prompt, /yes, and/i);
  assert.match(prompt, /net-new or a genuine evolution/i);
  // The discussion-extension rules only appear when prior ideas exist.
  assert.ok(prompt.includes("remix two ideas into a new one"));
});

test("non-brainstorm actions do not leak brainstorming rules", () => {
  const prompt = composePrompt({
    actionType: "generate",
    originalInput: "Plan a community event",
  });

  assert.doesNotMatch(prompt, /Brainstorming rules:/);
});

test("brainstorm prompt without source omits discussion-extension rules", () => {
  const prompt = composePrompt({
    actionType: "brainstorm",
    originalInput: "Plan a community event",
  });

  assert.doesNotMatch(prompt, /remix two ideas into a new one/);
});

test("hasPriorIdeas hint enables discussion mode when source is delivered separately", () => {
  // The v2 queued runner appends prior results as a separate budget-managed
  // block and passes sourceText:null, so the directives must still switch into
  // multi-model discussion mode via the hint alone.
  const prompt = composePrompt({
    actionType: "brainstorm",
    originalInput: "Plan a community event",
    sourceText: null,
    hasPriorIdeas: true,
  });

  assert.match(prompt, /yes, and/i);
  assert.match(prompt, /net-new or a genuine evolution/i);
  assert.ok(prompt.includes("remix two ideas into a new one"));
});

test("getSourceHeading frames brainstorm prior results as a living discussion", () => {
  assert.match(getSourceHeading("brainstorm"), /extend this living discussion/i);
  assert.match(getSourceHeading("improve"), /Source result to use/i);
});
