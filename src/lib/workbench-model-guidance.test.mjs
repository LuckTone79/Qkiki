import test from "node:test";
import assert from "node:assert/strict";

import { getModelGuidance } from "./workbench-model-guidance.ts";

test("getModelGuidance marks the default model as recommended", () => {
  const guidance = getModelGuidance(
    "openai",
    "gpt-5.6-terra",
    "gpt-5.6-terra",
    "en",
  );

  assert.equal(guidance.recommended, true);
  assert.equal(guidance.recommendedLabel, "Recommended start");
});

test("getModelGuidance derives fast traits for lightweight and flash models", () => {
  assert.deepEqual(
    getModelGuidance("openai", "gpt-5.6-luna", "gpt-5.6-terra", "en").traits,
    ["Fast"],
  );

  assert.deepEqual(
    getModelGuidance("google", "gemini-3.6-flash", "gemini-3.1-pro-preview", "en").traits,
    ["Fast"],
  );
});

test("getModelGuidance classifies balanced latest models correctly", () => {
  assert.deepEqual(
    getModelGuidance("openai", "gpt-5.6-terra", "gpt-5.6-terra", "en").traits,
    ["Balanced"],
  );

  assert.deepEqual(
    getModelGuidance("anthropic", "claude-sonnet-5", "claude-sonnet-5", "en").traits,
    ["Balanced", "Review"],
  );
});

test("getModelGuidance classifies latest top-tier models correctly", () => {
  assert.deepEqual(
    getModelGuidance("openai", "gpt-5.6-sol", "gpt-5.6-terra", "en").traits,
    ["Deep"],
  );

  assert.deepEqual(
    getModelGuidance("anthropic", "claude-fable-5", "claude-sonnet-5", "en").traits,
    ["Deep", "Review"],
  );
});

test("getModelGuidance keeps legacy-but-supported GPT tiers selectable", () => {
  assert.deepEqual(
    getModelGuidance("openai", "gpt-5.5-pro", "gpt-5.6-terra", "en").traits,
    ["Deep"],
  );
  assert.deepEqual(
    getModelGuidance("openai", "gpt-5.4-nano", "gpt-5.6-terra", "en").traits,
    ["Fast", "Balanced"],
  );
});
