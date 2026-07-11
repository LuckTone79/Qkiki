import test from "node:test";
import assert from "node:assert/strict";

import {
  ACTION_TYPES,
  BRANCH_REVIEW_ACTION_TYPES,
  BRANCH_ACTION_TYPES,
  WORKFLOW_ACTION_TYPES,
  WORKFLOW_STEP_ACTION_TYPES,
} from "./types.ts";
import { getActionTypeDisplayLabel } from "./action-display.ts";

test("central action tuples include the two new actions in the expected selectors", () => {
  assert.deepEqual(ACTION_TYPES, [
    "generate",
    "brainstorm",
    "critique",
    "fact_check",
    "improve",
    "summarize",
    "simplify",
    "consistency_review",
    "code_review",
    "follow_up",
    "scenario_develop",
    "deep_dive",
  ]);

  assert.deepEqual(WORKFLOW_ACTION_TYPES, [
    "generate",
    "brainstorm",
    "critique",
    "fact_check",
    "improve",
    "summarize",
    "simplify",
    "consistency_review",
    "code_review",
    "scenario_develop",
    "deep_dive",
  ]);
  assert.equal(WORKFLOW_ACTION_TYPES.includes("follow_up"), false);
  assert.equal(WORKFLOW_STEP_ACTION_TYPES.includes("follow_up"), true);

  assert.deepEqual(BRANCH_REVIEW_ACTION_TYPES, [
    "brainstorm",
    "critique",
    "fact_check",
    "improve",
    "summarize",
    "simplify",
    "consistency_review",
    "code_review",
    "scenario_develop",
    "deep_dive",
  ]);
  assert.equal(BRANCH_REVIEW_ACTION_TYPES.includes("follow_up"), false);
  assert.equal(BRANCH_ACTION_TYPES.includes("follow_up"), true);
});

test("new action labels are bilingual", () => {
  assert.equal(getActionTypeDisplayLabel("scenario_develop", "en"), "Scenario development");
  assert.equal(getActionTypeDisplayLabel("scenario_develop", "ko"), "시나리오 발전");
  assert.equal(getActionTypeDisplayLabel("deep_dive", "en"), "Deep dive");
  assert.equal(getActionTypeDisplayLabel("deep_dive", "ko"), "딥 다이브");
});
