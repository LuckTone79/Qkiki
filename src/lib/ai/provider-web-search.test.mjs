import test from "node:test";
import assert from "node:assert/strict";

import { composePrompt } from "./prompt.ts";
import {
  buildProviderWebSearchTools,
  shouldEnableProviderWebSearch,
} from "./provider-web-search.ts";

test("provider web search policy does not trigger on the timestamp header alone", () => {
  assert.equal(
    shouldEnableProviderWebSearch({
      requestType: "generate",
      prompt:
        "Current time context:\n- UTC: 2026-06-12T00:00:00.000Z\n- Asia/Seoul: 2026-06-12, 09:00:00",
    }),
    false,
  );
});

test("provider web search policy enables search when freshness directives are present", () => {
  assert.equal(
    shouldEnableProviderWebSearch({
      requestType: "generate",
      prompt: "Freshness and web research rules:\n- use web search",
    }),
    true,
  );
});

test("provider web search policy enables search for fact-check reviews", () => {
  assert.equal(
    shouldEnableProviderWebSearch({
      requestType: "fact_check",
      prompt: "Review this source answer.",
    }),
    true,
  );
});

test("provider web search policy ignores stable deep-dive prior-only context", () => {
  const prompt = composePrompt({
    actionType: "deep_dive",
    originalInput: "Analyze organizational lock-in.",
    sourceContextKind: "prior_result",
    sourceText: null,
    researchSourceText:
      "Prior result: compare incentive gradients, governance coupling, and failure boundaries.",
  });

  assert.equal(
    shouldEnableProviderWebSearch({
      requestType: "deep_dive",
      prompt,
    }),
    false,
  );
});

test("provider web search policy catches current deep-dive claims found only in resolved prior source", () => {
  const prompt = composePrompt({
    actionType: "deep_dive",
    originalInput: "Analyze organizational lock-in.",
    sourceContextKind: "prior_result",
    sourceText: null,
    researchSourceText:
      "Prior result: verify the latest 2026 model releases and current pricing before comparing incentives.",
  });

  assert.equal(
    shouldEnableProviderWebSearch({
      requestType: "deep_dive",
      prompt,
    }),
    true,
  );
});

test("provider web search policy does not enable search for unrelated cached reruns", () => {
  assert.equal(
    shouldEnableProviderWebSearch({
      requestType: "rerun",
      prompt: "Write a short poem about a quiet desk.",
    }),
    false,
  );
});

test("provider web search tool configs match each provider API shape", () => {
  assert.deepEqual(buildProviderWebSearchTools("openai"), [
    { type: "web_search", search_context_size: "low" },
  ]);
  assert.deepEqual(buildProviderWebSearchTools("anthropic"), [
    { type: "web_search_20260209", name: "web_search" },
  ]);
  assert.deepEqual(buildProviderWebSearchTools("google"), [{ google_search: {} }]);
  assert.deepEqual(buildProviderWebSearchTools("xai"), [{ type: "web_search" }]);
});
