import assert from "node:assert/strict";
import test from "node:test";

import { branchRunSchema, runWorkbenchSchema } from "./validation.ts";

test("workbench and branch payloads accept Spanish output", () => {
  const target = { provider: "openai", model: "gpt-5.5" };
  assert.equal(
    runWorkbenchSchema.safeParse({
      originalInput: "Hola",
      outputLanguage: "es",
      mode: "parallel",
      targets: [target],
    }).success,
    true,
  );
  assert.equal(
    branchRunSchema.safeParse({
      parentResultId: "result-1",
      outputLanguage: "es",
      actionType: "improve",
      instruction: "Mejora la respuesta",
      targets: [target],
    }).success,
    true,
  );
});
