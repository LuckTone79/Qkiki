import test from "node:test";
import assert from "node:assert/strict";

import { getParallelComparisonSummaryTarget } from "./summary-model.ts";

test("parallel comparison summary uses the current OpenAI flagship target", () => {
  assert.deepEqual(getParallelComparisonSummaryTarget(), {
    provider: "openai",
    model: "gpt-5.5",
  });
});
