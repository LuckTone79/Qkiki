import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPresetListQuery,
  buildProjectListQuery,
  buildSessionListQuery,
} from "./query-shapes.ts";

test("session list query matches the saved-session API response shape", () => {
  assert.deepEqual(buildSessionListQuery("user_1"), {
    where: { userId: "user_1" },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      originalInput: true,
      mode: true,
      createdAt: true,
      updatedAt: true,
      project: { select: { id: true, name: true } },
      _count: { select: { results: true, workflowSteps: true } },
      executionRuns: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          id: true,
          mode: true,
          status: true,
          totalStepsPlanned: true,
          totalStepsDone: true,
          finalResultId: true,
          updatedAt: true,
        },
      },
    },
  });
});

test("project list query includes sidebar preview sessions", () => {
  assert.deepEqual(buildProjectListQuery("user_1"), {
    where: { userId: "user_1" },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { sessions: true } },
      sessions: {
        orderBy: { updatedAt: "desc" },
        take: 3,
        select: {
          id: true,
          title: true,
          updatedAt: true,
          _count: { select: { results: true } },
        },
      },
    },
  });
});

test("preset list query keeps preset ordering and ownership filter", () => {
  assert.deepEqual(buildPresetListQuery("user_1"), {
    where: { userId: "user_1" },
    orderBy: { updatedAt: "desc" },
  });
});
