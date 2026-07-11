import test from "node:test";
import assert from "node:assert/strict";

import { branchRunSchema, workflowStepSchema } from "./validation.ts";

const validWorkflowStep = {
  orderIndex: 1,
  actionType: "scenario_develop",
  targetProvider: "openai",
  targetModel: "gpt-5.5",
  sourceMode: "original",
};

const validBranchRun = {
  parentResultId: "result-1",
  actionType: "deep_dive",
  instruction: "Analyze the topic in depth.",
  targets: [{ provider: "openai", model: "gpt-5.5" }],
};

test("workflowStepSchema accepts the new workflow actions", () => {
  assert.equal(
    workflowStepSchema.safeParse(validWorkflowStep).success,
    true,
  );
  assert.equal(
    workflowStepSchema.safeParse({
      ...validWorkflowStep,
      actionType: "deep_dive",
    }).success,
    true,
  );
  assert.equal(
    workflowStepSchema.safeParse({
      ...validWorkflowStep,
      actionType: "follow_up",
    }).success,
    true,
  );
});

test("branchRunSchema accepts the new branch-review actions", () => {
  assert.equal(branchRunSchema.safeParse(validBranchRun).success, true);
  assert.equal(
    branchRunSchema.safeParse({
      ...validBranchRun,
      actionType: "scenario_develop",
    }).success,
    true,
  );
  assert.equal(
    branchRunSchema.safeParse({
      ...validBranchRun,
      actionType: "follow_up",
    }).success,
    true,
  );
});

test("unknown actions are rejected by both schemas", () => {
  assert.equal(
    workflowStepSchema.safeParse({
      ...validWorkflowStep,
      actionType: "unknown_action",
    }).success,
    false,
  );
  assert.equal(
    branchRunSchema.safeParse({
      ...validBranchRun,
      actionType: "unknown_action",
    }).success,
    false,
  );
});
