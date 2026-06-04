import test from "node:test";
import assert from "node:assert/strict";

import { buildWorkbenchRunPayload } from "./workbench-run-payload.ts";

const sampleStep = {
  orderIndex: 1,
  actionType: "generate",
  targetProvider: "openai",
  targetModel: "gpt-5.4-mini",
  sourceMode: "original",
  sourceResultId: null,
  instructionTemplate: "Draft a strong answer.",
};

test("buildWorkbenchRunPayload strips advanced-only fields in simple mode", () => {
  const payload = buildWorkbenchRunPayload({
    sessionId: "session-1",
    projectId: "project-1",
    title: "Demo",
    originalInput: "Explain Qkiki.",
    additionalInstruction: "Be extra formal.",
    outputStyle: "bullet",
    outputLanguage: "ko",
    attachments: [{ id: "att-1" }],
    mode: "sequential",
    targets: [],
    workflowSteps: [sampleStep],
    workflowControl: { repeatBlocks: [{ startStepOrder: 1, endStepOrder: 1, repeatCount: 3 }] },
    builderExperience: "simple",
  });

  assert.equal(payload.additionalInstruction, "");
  assert.equal(payload.outputStyle, "detailed");
  assert.deepEqual(payload.attachmentIds, []);
  assert.equal(payload.workflowControl, undefined);
});

test("buildWorkbenchRunPayload preserves advanced fields in advanced mode", () => {
  const payload = buildWorkbenchRunPayload({
    sessionId: "session-1",
    projectId: "project-1",
    title: "Demo",
    originalInput: "Explain Qkiki.",
    additionalInstruction: "Be extra formal.",
    outputStyle: "bullet",
    outputLanguage: "ko",
    attachments: [{ id: "att-1" }],
    mode: "sequential",
    targets: [],
    workflowSteps: [sampleStep],
    workflowControl: { repeatBlocks: [{ startStepOrder: 1, endStepOrder: 1, repeatCount: 3 }] },
    builderExperience: "advanced",
  });

  assert.equal(payload.additionalInstruction, "Be extra formal.");
  assert.equal(payload.outputStyle, "bullet");
  assert.deepEqual(payload.attachmentIds, ["att-1"]);
  assert.deepEqual(payload.workflowControl, {
    repeatBlocks: [{ startStepOrder: 1, endStepOrder: 1, repeatCount: 3 }],
  });
});

test("buildWorkbenchRunPayload only includes targets for parallel mode", () => {
  const payload = buildWorkbenchRunPayload({
    sessionId: null,
    projectId: null,
    title: null,
    originalInput: "Compare models.",
    additionalInstruction: "",
    outputStyle: "detailed",
    outputLanguage: "en",
    attachments: [],
    mode: "parallel",
    targets: [{ provider: "openai", model: "gpt-5.4-mini" }],
    workflowSteps: [sampleStep],
    workflowControl: { repeatBlocks: [] },
    builderExperience: "simple",
  });

  assert.deepEqual(payload.targets, [{ provider: "openai", model: "gpt-5.4-mini" }]);
  assert.equal(payload.steps, undefined);
  assert.equal(payload.workflowControl, undefined);
});
