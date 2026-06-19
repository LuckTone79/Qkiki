import test from "node:test";
import assert from "node:assert/strict";

import {
  serializePresetListItem,
  serializeProjectListItem,
  serializeSessionListItem,
} from "./serializers.ts";

test("serializeSessionListItem preserves API shape with ISO dates", () => {
  const item = serializeSessionListItem({
    id: "session_1",
    title: "Session",
    originalInput: "Input",
    mode: "sequential",
    createdAt: new Date("2026-06-19T01:00:00.000Z"),
    updatedAt: new Date("2026-06-19T02:00:00.000Z"),
    project: { id: "project_1", name: "Project" },
    _count: { results: 2, workflowSteps: 3 },
    executionRuns: [
      {
        id: "run_1",
        mode: "sequential",
        status: "completed",
        totalStepsPlanned: 3,
        totalStepsDone: 3,
        finalResultId: "result_1",
        updatedAt: new Date("2026-06-19T03:00:00.000Z"),
      },
    ],
  });

  assert.equal(item.createdAt, "2026-06-19T01:00:00.000Z");
  assert.equal(item.updatedAt, "2026-06-19T02:00:00.000Z");
  assert.equal(item.executionRuns[0].updatedAt, "2026-06-19T03:00:00.000Z");
  assert.deepEqual(item._count, { results: 2, workflowSteps: 3 });
});

test("serializeProjectListItem preserves nested sessions with ISO dates", () => {
  const item = serializeProjectListItem({
    id: "project_1",
    name: "Project",
    description: null,
    sharedContext: "Context",
    updatedAt: new Date("2026-06-19T01:00:00.000Z"),
    _count: { sessions: 4 },
    sessions: [
      {
        id: "session_1",
        title: "Session",
        updatedAt: new Date("2026-06-19T02:00:00.000Z"),
        _count: { results: 5 },
      },
    ],
  });

  assert.equal(item.updatedAt, "2026-06-19T01:00:00.000Z");
  assert.equal(item.sessions[0].updatedAt, "2026-06-19T02:00:00.000Z");
  assert.deepEqual(item.sessions[0]._count, { results: 5 });
});

test("serializePresetListItem preserves workflow data with ISO dates", () => {
  const item = serializePresetListItem({
    id: "preset_1",
    name: "Preset",
    description: null,
    workflowJson: "{\"steps\":[]}",
    updatedAt: new Date("2026-06-19T01:00:00.000Z"),
  });

  assert.deepEqual(item, {
    id: "preset_1",
    name: "Preset",
    description: null,
    workflowJson: "{\"steps\":[]}",
    updatedAt: "2026-06-19T01:00:00.000Z",
  });
});
