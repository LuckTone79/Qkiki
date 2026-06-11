import test from "node:test";
import assert from "node:assert/strict";

import {
  buildProviderWebSearchTools,
  shouldEnableProviderWebSearch,
} from "./provider-web-search.ts";

test("provider web search policy enables search for current factual prompts", () => {
  assert.equal(
    shouldEnableProviderWebSearch({
      requestType: "generate",
      prompt: "Current time context:\nUTC: 2026-06-12T00:00:00.000Z\n\nFreshness and web research rules:\n- use web search",
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
  assert.deepEqual(buildProviderWebSearchTools("google"), [
    { google_search: {} },
  ]);
  assert.deepEqual(buildProviderWebSearchTools("xai"), [
    { type: "web_search" },
  ]);
});
