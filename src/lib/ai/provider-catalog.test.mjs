import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  getImageModels,
  getProviderCatalog,
  isImageModel,
  normalizeProviderModel,
  requireSupportedProviderModel,
  resolveSupportedProviderModel,
} from "./provider-catalog.ts";

test("provider catalog keeps only current supported model tiers", () => {
  assert.deepEqual(getProviderCatalog("anthropic").models, [
    "claude-sonnet-5",
    "claude-sonnet-4-6",
    "claude-haiku-4-5",
    "claude-opus-4-8",
  ]);

  assert.deepEqual(getProviderCatalog("google").models, [
    "gemini-3.5-flash",
    "gemini-3-flash-preview",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-3.1-pro-preview",
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

  // gemini-3-pro-preview was retired by Google (HTTP 404); legacy aliases and
  // the dead id itself must heal to an available pro model.
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
    "gemini-3-flash-preview",
  );
  assert.equal(
    normalizeProviderModel("google", "gemini-3.1-flash-lite"),
    "gemini-2.5-flash-lite",
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
  assert.equal(isImageModel("openai", "gpt-5.5"), false);
  assert.equal(isImageModel("anthropic", "gpt-image-1"), false);
});

test("provider model resolution normalizes aliases and rejects non-catalog models", () => {
  assert.equal(
    resolveSupportedProviderModel("google", "  gemini-3-pro-preview  "),
    "gemini-3.1-pro-preview",
  );
  assert.equal(
    resolveSupportedProviderModel("openai", "gpt-image-2"),
    "gpt-image-2",
  );
  assert.equal(
    resolveSupportedProviderModel("openai", "gemini-3.5-flash"),
    null,
  );
  assert.throws(
    () => requireSupportedProviderModel("xai", "attacker-controlled-model"),
    /Unsupported model for xai/,
  );
});

test("callProvider enforces catalog and pricing policy before runtime lookup", () => {
  const source = readFileSync(new URL("./providers.ts", import.meta.url), "utf8");
  const modelGuardIndex = source.indexOf(
    "const model = requireSupportedProviderModel(input.provider, input.model);",
  );
  const pricingGuardIndex = source.indexOf(
    "requireRegisteredProviderPricing({ provider: input.provider, model });",
  );
  const runtimeLookupIndex = source.indexOf(
    "getProviderRuntimeConfig(normalizedInput.provider)",
  );

  assert.ok(modelGuardIndex >= 0);
  assert.ok(pricingGuardIndex > modelGuardIndex);
  assert.ok(runtimeLookupIndex > pricingGuardIndex);
});
