import test from "node:test";
import assert from "node:assert/strict";

import {
  runWorkbenchSchema,
  targetModelSchema,
  workflowStepSchema,
} from "./validation.ts";

test("target model validation normalizes supported legacy aliases", () => {
  assert.deepEqual(
    targetModelSchema.parse({
      provider: "google",
      model: " gemini-3-pro-preview ",
    }),
    {
      provider: "google",
      model: "gemini-3.1-pro-preview",
    },
  );
});

test("workflow step validation normalizes its target model", () => {
  const parsed = workflowStepSchema.parse({
    orderIndex: 1,
    actionType: "critique",
    targetProvider: "anthropic",
    targetModel: "claude-opus-4-7",
    sourceMode: "original",
  });

  assert.equal(parsed.targetModel, "claude-opus-4-8");
});

test("target and workflow validation reject unknown or cross-provider models", () => {
  assert.equal(
    targetModelSchema.safeParse({
      provider: "openai",
      model: "gemini-3.5-flash",
    }).success,
    false,
  );
  assert.equal(
    workflowStepSchema.safeParse({
      orderIndex: 1,
      actionType: "generate",
      targetProvider: "xai",
      targetModel: "attacker-controlled-model",
      sourceMode: "original",
    }).success,
    false,
  );
});

test("workbench validation rejects invalid targets before execution", () => {
  const parsed = runWorkbenchSchema.safeParse({
    originalInput: "Review this payload.",
    mode: "parallel",
    targets: [{ provider: "openai", model: "attacker-controlled-model" }],
  });

  assert.equal(parsed.success, false);
});
