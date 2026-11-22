import test from "node:test";
import assert from "node:assert/strict";
import { estimateWorkbenchRunCredits } from "../credits.ts";
import { parseImagePricing } from "./image-model-discovery.ts";
import { buildWorkbenchRunPayload } from "../workbench-run-payload.ts";

test("OpenAI image quote includes the pinned square tier and prompt tokens", () => {
  const model = "gpt-image-2.6-flare";
  const doc = `Model ID: \`${model}\`
Output modalities: image
### Text tokens
| Input | $5 | 1M tokens |
### Image tokens
| Output | $30 | 1M tokens |
## Endpoints
| Image generation | \`v1/images/generations\` | Supported |`;
  const rate = parseImagePricing("openai", { id: model }, doc);
  assert.equal(rate.perImageUsd, 0.0435);
  const quote = estimateWorkbenchRunCredits({
    mode: "image", originalInput: "A blue square", targets: [{ provider: "openai", model }],
    modelPrices: { ["openai:" + model]: rate },
  });
  assert.equal(quote.callBreakdown[0].billingKind, "image");
  assert.ok(quote.estimatedRawCostUsd > rate.perImageUsd);
  assert.equal(parseImagePricing("openai", { id: "chatgpt-image-latest" }, doc), undefined);
});

test("Google requires the image generation capability and exact 1K pricing", () => {
  const id = "gemini-3.1-flash-image";
  const doc = `## Gemini Flash Image {% id="${id}" %}
{% tab title="Standard" %}
* $0.50 (text/image)
* $3 (text and thinking)
$60.00 (images)
{% /tab %}
Output images at 1K (1024x1024px) consume 1120 tokens
## Other model`;
  assert.equal(parseImagePricing("google", { id, methods: ["generateContent"] }, doc).perImageUsd, 0.0672);
  assert.equal(parseImagePricing("google", { id, methods: ["embedContent"] }, doc), undefined);
  assert.equal(parseImagePricing("google", { id: id + "-preview", methods: ["generateContent"] }, doc), undefined);
});

test("image mode serializes its selected models for the worker", () => {
  const targets = [{ provider: "xai", model: "grok-imagine-image-2.0" }];
  const payload = buildWorkbenchRunPayload({ mode: "image", targets, attachments: [] });
  assert.equal(payload.mode, "image");
  assert.deepEqual(payload.targets, targets);
  assert.equal(payload.steps, undefined);
});
