import test from "node:test";
import assert from "node:assert/strict";
import { fetchProviderModels, isStableTextModel, parseOfficialTextPrice } from "./model-discovery.ts";
import { estimateWorkbenchRunCredits } from "../credits.ts";

test("collects all Google pages and rejects incomplete responses", async () => {
  const request = async (url, init) => {
    assert.equal(init.headers["x-goog-api-key"], "fixture");
    const page = url.searchParams.get("pageToken");
    const rows = [{ name: page ? "models/gemini-4-flash" : "models/gemini-3-flash", supportedGenerationMethods: ["generateContent"] }];
    return Response.json(page ? { models: rows } : { models: rows, nextPageToken: "second" });
  };
  assert.deepEqual((await fetchProviderModels("google", "fixture", request)).map((item) => item.id),
    ["gemini-3-flash", "gemini-4-flash"]);
  await assert.rejects(fetchProviderModels("google", "fixture", async () => Response.json({ models: [] })), /empty_model_list/);
});

test("holds previews and reads standard and tiered official rates", () => {
  assert.equal(isStableTextModel("google", "gemini-4-flash-preview"), false);
  assert.equal(isStableTextModel("openai", "gpt-6.2-sol"), true);
  assert.equal(isStableTextModel("xai", "grok-2-image-1212"), false);
  const pricingDoc = `### Standard pricing data
| Model | Short context input | Short context output | Short context cached input | Short context 30m write | Short context 12h write | Long context input | Long context output | Long context cached input | Long context 30m write | Long context 12h write |
| gpt-6.2-sol | $2.00 | $10.00 | $0.10 | $2.50 | $5.00 | $4.00 | $15.00 | $0.20 | $5.00 | $10.00 |
| Model | Input | Output | Cached input |
| gpt-6.2-mini | $0.50 | $2.00 | $0.05 |
### Batch pricing data
| gpt-6.2-sol | $1.00 | $5.00 | $0.05 |`;
  const price = parseOfficialTextPrice("openai", { id: "gpt-6.2-sol" }, pricingDoc);
  assert.deepEqual(price, { promptPerMillion: 4, completionPerMillion: 15 });
  assert.equal(parseOfficialTextPrice("openai", { id: "gpt-8" }, pricingDoc), undefined);
  assert.deepEqual(estimateWorkbenchRunCredits({
    mode: "parallel", originalInput: "fixture", targets: [{ provider: "openai", model: "gpt-6.2-sol" }],
    modelPrices: { "openai:gpt-6.2-sol": price },
  }).callBreakdown[0].modelPricing, price);
});

test("Google selects the upper published standard rate across scheduled price bands", () => {
  const document = `## Gemini Flash {% id="gemini-3.8-flash" %}
{% tab title="Standard" %}
* Paid Tier, per 1M tokens in USD
---
* Input price
* Free of charge
* $0.75 through December 31, 2026.
$1.50 starting January 1, 2027.
---
* Output price (including thinking tokens)
* Free of charge
* $3.75 through December 31, 2026.
$7.50 starting January 1, 2027.
---
{% /tab %}`;
  assert.deepEqual(parseOfficialTextPrice("google", { id: "gemini-3.8-flash" }, document),
    { promptPerMillion: 1.5, completionPerMillion: 7.5 });
});
