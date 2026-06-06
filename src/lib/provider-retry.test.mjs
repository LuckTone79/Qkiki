import test from "node:test";
import assert from "node:assert/strict";

import {
  getProviderRetryDelayMs,
  isRetryableProviderErrorMessage,
} from "./provider-retry.ts";

test("Gemini rate limit (429 RESOURCE_EXHAUSTED) is retryable", () => {
  const error =
    "google: [429] RESOURCE_EXHAUSTED: Quota exceeded for quota metric.";

  assert.equal(isRetryableProviderErrorMessage(error), true);
});

test("Gemini overloaded (503 UNAVAILABLE) is retryable", () => {
  const error =
    "google: [503] UNAVAILABLE: The model is overloaded. Please try again later.";

  assert.equal(isRetryableProviderErrorMessage(error), true);
});

test("Gemini billing/credit failures are not retried", () => {
  const error = "google: [400] Your prepayment credits are depleted.";

  assert.equal(isRetryableProviderErrorMessage(error), false);
});

test("non-provider failures are not retried", () => {
  assert.equal(isRetryableProviderErrorMessage(""), false);
  assert.equal(
    isRetryableProviderErrorMessage("google: invalid API key."),
    false,
  );
});

test("retryable provider errors back off longer than timeouts", () => {
  const transientDelay = getProviderRetryDelayMs(
    "google: [503] UNAVAILABLE: The model is overloaded.",
    1,
  );
  const timeoutDelay = getProviderRetryDelayMs(
    "google: provider request timed out after 75 seconds.",
    1,
  );

  assert.equal(timeoutDelay, 750);
  assert.ok(transientDelay >= 1000);
});

test("backoff grows with attempts and stays bounded", () => {
  const first = getProviderRetryDelayMs("google: [429] RESOURCE_EXHAUSTED", 1);
  const later = getProviderRetryDelayMs("google: [429] RESOURCE_EXHAUSTED", 6);

  assert.ok(later >= first);
  assert.ok(later <= 8000 + 400);
});
