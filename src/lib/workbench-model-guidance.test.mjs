import test from "node:test";
import assert from "node:assert/strict";

import { getModelGuidance } from "./workbench-model-guidance.ts";

test("getModelGuidance marks the default model as recommended", () => {
  const guidance = getModelGuidance(
    "openai",
    "gpt-5.4-mini",
    "gpt-5.4-mini",
    "en",
  );

  assert.equal(guidance.recommended, true);
  assert.equal(guidance.recommendedLabel, "Recommended start");
});

test("getModelGuidance derives fast traits for mini and flash models", () => {
  assert.deepEqual(
    getModelGuidance("openai", "gpt-5.4-mini", "gpt-5.4", "en").traits,
    ["Fast", "Balanced"],
  );

  assert.deepEqual(
    getModelGuidance("google", "gemini-2.5-flash", "gemini-2.5-pro", "ko").traits,
    ["빠름"],
  );
});

test("getModelGuidance derives deeper review traits for opus-like models", () => {
  assert.deepEqual(
    getModelGuidance(
      "anthropic",
      "claude-opus-4-7",
      "claude-sonnet-4-6",
      "en",
    ).traits,
    ["Deep", "Review"],
  );
});
