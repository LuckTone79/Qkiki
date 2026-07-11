import test from "node:test";
import assert from "node:assert/strict";

import { estimateCost } from "./pricing.ts";

test("runtime cost estimation fails closed for an unregistered model", () => {
  assert.throws(
    () =>
      estimateCost({
        provider: "openai",
        model: "attacker-controlled-model",
        promptTokens: 10,
        completionTokens: 10,
      }),
    /Pricing is not registered/,
  );
  assert.throws(
    () =>
      estimateCost({
        provider: "openai",
        model: "attacker-controlled-model",
      }),
    /Pricing is not registered/,
  );
});

test("runtime cost estimation still supports registered text and image models", () => {
  assert.equal(
    estimateCost({
      provider: "openai",
      model: "gpt-5.4-mini",
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
    }),
    2.625,
  );
  assert.equal(
    estimateCost({
      provider: "openai",
      model: "gpt-image-2",
      imageCount: 1,
    }),
    0.053,
  );
});
