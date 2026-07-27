import test from "node:test";
import assert from "node:assert/strict";

import {
  getImageModels,
  getProviderCatalog,
  isImageModel,
  normalizeProviderModel,
} from "./provider-catalog.ts";

test("provider catalog keeps only current supported model tiers", () => {
  assert.deepEqual(getProviderCatalog("openai").models, [
    "gpt-5.6-luna",
    "gpt-5.6-terra",
    "gpt-5.6-sol",
  ]);

  assert.deepEqual(getProviderCatalog("anthropic").models, [
    "claude-haiku-4-5",
    "claude-sonnet-5",
    "claude-opus-5",
    "claude-fable-5",
  ]);

  assert.deepEqual(getProviderCatalog("google").models, [
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-3.1-pro-preview",
  ]);

  assert.deepEqual(getProviderCatalog("xai").models, [
    "grok-4.5",
  ]);
});

test("normalizeProviderModel upgrades legacy aliases to current supported models", () => {
  assert.equal(
    normalizeProviderModel("openai", "gpt-5.5"),
    "gpt-5.6-sol",
  );
  assert.equal(
    normalizeProviderModel("openai", "gpt-5.4"),
    "gpt-5.6-terra",
  );
  assert.equal(
    normalizeProviderModel("openai", "gpt-5.4-mini"),
    "gpt-5.6-luna",
  );

  assert.equal(
    normalizeProviderModel("anthropic", "claude-opus-4-7"),
    "claude-opus-5",
  );
  assert.equal(
    normalizeProviderModel("anthropic", "claude-opus-4-1-20250805"),
    "claude-opus-5",
  );
  assert.equal(
    normalizeProviderModel("anthropic", "claude-sonnet-4-6"),
    "claude-sonnet-5",
  );
  assert.equal(
    normalizeProviderModel("anthropic", "claude-haiku-4-5-20251001"),
    "claude-haiku-4-5",
  );

  assert.equal(
    normalizeProviderModel("google", "gemini-3-pro-preview"),
    "gemini-3.1-pro-preview",
  );
  assert.equal(
    normalizeProviderModel("google", "gemini-3.1-pro"),
    "gemini-3.1-pro-preview",
  );
  assert.equal(
    normalizeProviderModel("google", "gemini-3.5-flash"),
    "gemini-3.5-flash",
  );
  assert.equal(
    normalizeProviderModel("google", "gemini-3-flash-preview"),
    "gemini-3.5-flash",
  );
  assert.equal(
    normalizeProviderModel("google", "gemini-2.5-flash"),
    "gemini-3.6-flash",
  );
  assert.equal(
    normalizeProviderModel("google", "gemini-2.5-flash-lite"),
    "gemini-3.1-flash-lite",
  );

  assert.equal(
    normalizeProviderModel("xai", "grok-4.3"),
    "grok-4.5",
  );
  assert.equal(
    normalizeProviderModel("xai", "grok-4.20-reasoning"),
    "grok-4.5",
  );
});

test("image model catalog exposes generators separately from chat models", () => {
  assert.deepEqual(getImageModels("openai"), ["gpt-image-2", "gpt-image-1"]);
  assert.deepEqual(getImageModels("anthropic"), []);
  assert.deepEqual(getImageModels("google"), [
    "imagen-4.0-generate-001",
    "imagen-4.0-fast-generate-001",
    "imagen-4.0-ultra-generate-001",
    "gemini-2.5-flash-image",
    "gemini-3-pro-image",
  ]);
  assert.deepEqual(getImageModels("xai"), [
    "grok-imagine-image-quality",
    "grok-imagine-image",
    "grok-2-image-1212",
  ]);
});

test("isImageModel only matches configured image generators", () => {
  assert.equal(isImageModel("openai", "gpt-image-2"), true);
  assert.equal(isImageModel("google", "imagen-4.0-generate-001"), true);
  assert.equal(isImageModel("xai", "grok-imagine-image-quality"), true);
  assert.equal(isImageModel("openai", "gpt-5.6-sol"), false);
  assert.equal(isImageModel("anthropic", "gpt-image-1"), false);
});
