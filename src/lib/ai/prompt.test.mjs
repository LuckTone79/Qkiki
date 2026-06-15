import test from "node:test";
import assert from "node:assert/strict";

import { composePrompt, getActionLabel } from "./prompt.ts";

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

test("code_review action label describes reviewing prior code without forcing changes", () => {
  const label = getActionLabel("code_review");
  assert.match(label, /code reviewer/i);
  assert.match(label, /as-is/i);
});

test("code_review prompt injects review rules and the no-force-changes guard", () => {
  const prompt = composePrompt({
    actionType: "code_review",
    originalInput: "Write a function that parses a CSV file",
    sourceText: "function parse(s){ return s.split(',') }",
  });

  assert.match(prompt, /Code review rules:/);
  assert.match(prompt, /Code from the previous model to review/);
  // The defining behavior: leave already-good code untouched instead of forcing edits.
  assert.match(prompt, /NO_CHANGES:/);
  assert.match(prompt, /do not force improvements/i);
  assert.match(prompt, /cosmetic, trivial, or stylistic-only edits/i);
});

test("non-code_review actions do not leak code review rules", () => {
  const prompt = composePrompt({
    actionType: "improve",
    originalInput: "Write a function that parses a CSV file",
    sourceText: "function parse(s){ return s.split(',') }",
  });

  assert.doesNotMatch(prompt, /Code review rules:/);
  assert.doesNotMatch(prompt, /NO_CHANGES:/);
});
