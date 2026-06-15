import test from "node:test";
import assert from "node:assert/strict";

import {
  composePrompt,
  getActionLabel,
  getSourceHeading,
  shouldPreferWebSearch,
} from "./prompt.ts";

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

test("prompt always includes the current timestamp context", () => {
  const prompt = composePrompt({
    actionType: "generate",
    originalInput: "오늘 경기 일정을 정리해줘",
    currentDate: new Date("2026-06-12T01:30:00.000Z"),
  });

  assert.match(prompt, /Current time context:/);
  assert.match(prompt, /2026-06-12T01:30:00.000Z/);
  assert.match(prompt, /Resolve relative dates/i);
});

test("freshness-sensitive prompts prefer web search and source-grounded answers", () => {
  const prompt = composePrompt({
    actionType: "generate",
    originalInput: "2026년 6월 12일 월드컵 한국 대 체코 경기 승률을 숫자로 알려줘",
    currentDate: new Date("2026-06-12T01:30:00.000Z"),
  });

  assert.match(prompt, /Freshness and web research rules:/);
  assert.match(prompt, /use web search, grounding, browsing, or live-search tools/i);
  assert.match(prompt, /cite or name the sources/i);
});

test("fact-check prompts require the model's own assessment", () => {
  const prompt = composePrompt({
    actionType: "fact_check",
    originalInput: "검토해줘",
    sourceText: "이전 답변",
  });

  assert.match(prompt, /Fact-check review requirements:/);
  assert.match(prompt, /Your own assessment/i);
  assert.doesNotMatch(prompt, /Do not claim live web verification/);
});

test("freshness policy detects current factual questions and fact-check reviews", () => {
  assert.equal(
    shouldPreferWebSearch({
      actionType: "generate",
      originalInput: "오늘 환율과 최신 뉴스 알려줘",
    }),
    true,
  );
  assert.equal(
    shouldPreferWebSearch({
      actionType: "fact_check",
      originalInput: "이 답변을 검토해줘",
    }),
    true,
  );
  assert.equal(
    shouldPreferWebSearch({
      actionType: "brainstorm",
      originalInput: "새로운 앱 이름을 브레인스토밍해줘",
    }),
    false,
  );
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
