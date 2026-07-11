import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildGeminiOutputTokenConfig,
  buildMessagesOutputTokenConfig,
  buildResponsesOutputTokenConfig,
  getQuotedOutputTokenLimit,
} from "./output-token-policy.ts";

test("provider output caps use the same limits as credit quotes", () => {
  assert.equal(getQuotedOutputTokenLimit("generate"), 2200);
  assert.equal(getQuotedOutputTokenLimit("brainstorm"), 1800);
  assert.equal(getQuotedOutputTokenLimit("summarize"), 900);
  assert.equal(getQuotedOutputTokenLimit("parallel_comparison_summary"), 1200);
  assert.equal(getQuotedOutputTokenLimit("rerun"), 1400);
  assert.equal(getQuotedOutputTokenLimit(undefined), 1400);
});

test("provider request cap builders use each official API field", () => {
  assert.deepEqual(buildResponsesOutputTokenConfig(900), {
    max_output_tokens: 900,
  });
  assert.deepEqual(buildMessagesOutputTokenConfig(900), { max_tokens: 900 });
  assert.deepEqual(buildGeminiOutputTokenConfig(900), {
    maxOutputTokens: 900,
  });
});

test("all text provider request paths apply an output cap", () => {
  const source = readFileSync(new URL("./providers.ts", import.meta.url), "utf8");

  assert.equal(
    source.match(/buildResponsesOutputTokenConfig\(input\.outputTokenLimit\)/g)?.length,
    2,
  );
  assert.equal(
    source.match(/buildMessagesOutputTokenConfig\([^)]*\)/g)?.length,
    2,
  );
  assert.equal(
    source.match(/buildGeminiOutputTokenConfig\(input\.outputTokenLimit\)/g)?.length,
    1,
  );
});
