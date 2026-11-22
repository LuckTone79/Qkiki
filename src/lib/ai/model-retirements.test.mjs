import assert from "node:assert/strict";
import test from "node:test";
import { missedModels, officialRetirements } from "./model-retirements.ts";

const now = new Date("2026-11-22T06:00:00Z");

test("OpenAI excludes shutdown models and preserves future retirements and replacements", () => {
  const doc = `## Upcoming deprecations
| **Dec 1, 2026** | \`gpt-image-1.5\` | Deprecated | \`gpt-image-2\` |
## Past deprecations
| **Oct 23, 2026** | \`gpt-image-1\` | \`gpt-image-2\` |
## Feature
| **Oct 23, 2026** | \`unrelated\` |`;
  assert.deepEqual([...officialRetirements("openai", doc, [], now)], ["gpt-image-1"]);
});

test("Google distinguishes redirected model IDs and earliest possible shutdowns", () => {
  const doc = `{% table %}
* Model
* Release date
* Shutdown date
* Recommended replacement
---
* \`gemini-3.5-flash\`
* May 19, 2026
* N/A
* \`gemini-3.6-flash\` (automatically routes API requests to \`gemini-3.6-flash\`)
---
* \`gemini-still-served\`
* May 19, 2026
* June 1, 2026
* \`gemini-3.6-flash\`
{% /table %}`;
  assert.deepEqual([...officialRetirements("google", doc, [{ id: "gemini-still-served" }], now)], ["gemini-3.5-flash"]);
});

test("xAI retirement includes old redirect aliases without hiding their replacement", () => {
  const doc = `### grok-imagine-image-quality retired
Requests to \`grok-imagine-image-quality\` and \`grok-imagine-image-pro\` are now served by \`grok-imagine-image-2.0-low\`.`;
  assert.deepEqual([...officialRetirements("xai", doc, [], now)], ["grok-imagine-image-quality", "grok-imagine-image-pro"]);
});

test("counts each day once, checks model families independently and resets reappearing aliases", () => {
  const catalog = { models: ["claude-older", "claude-current"], imageModels: ["old-image"] };
  const observed = [{ id: "claude-current-20260406", aliases: ["claude-current"] }];
  assert.deepEqual(missedModels(catalog, observed, { "claude-older": 2 }, true), { "claude-older": 3 });
  assert.deepEqual(missedModels(catalog, observed, { "claude-older": 2 }, false), { "claude-older": 2 });
  assert.deepEqual(missedModels(catalog, [{ id: "claude-older" }, ...observed], { "claude-older": 3 }, true), {});
});
