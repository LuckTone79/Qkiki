import test from "node:test";
import assert from "node:assert/strict";

import {
  getProviderCatalog,
  normalizeProviderModel,
} from "./provider-catalog.ts";

test("provider catalog keeps only current supported model tiers", () => {
  assert.deepEqual(getProviderCatalog("anthropic").models, [
    "claude-sonnet-4-6",
    "claude-haiku-4-5",
    "claude-opus-4-8",
  ]);

  assert.deepEqual(getProviderCatalog("google").models, [
    "gemini-3-flash-preview",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-3-pro-preview",
    "gemini-2.5-pro",
  ]);
});

test("normalizeProviderModel upgrades legacy aliases to current supported models", () => {
  assert.equal(
    normalizeProviderModel("anthropic", "claude-opus-4-7"),
    "claude-opus-4-8",
  );
  assert.equal(
    normalizeProviderModel("anthropic", "claude-opus-4-1-20250805"),
    "claude-opus-4-8",
  );
  assert.equal(
    normalizeProviderModel("anthropic", "claude-haiku-4-5-20251001"),
    "claude-haiku-4-5",
  );

  assert.equal(
    normalizeProviderModel("google", "gemini-3.1-pro-preview"),
    "gemini-3-pro-preview",
  );
  assert.equal(
    normalizeProviderModel("google", "gemini-3.1-pro"),
    "gemini-3-pro-preview",
  );
  assert.equal(
    normalizeProviderModel("google", "gemini-3.5-flash"),
    "gemini-3-flash-preview",
  );
  assert.equal(
    normalizeProviderModel("google", "gemini-3-flash-preview"),
    "gemini-3-flash-preview",
  );
  assert.equal(
    normalizeProviderModel("google", "gemini-3.1-flash-lite"),
    "gemini-2.5-flash-lite",
  );
});
