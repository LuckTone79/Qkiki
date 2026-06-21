import test from "node:test";
import assert from "node:assert/strict";

import {
  buildUserActivitySummaries,
  mergeModelUsageRows,
  mergeProviderUsageRows,
  mergeUserCostRows,
  sortUserActivitySummaries,
} from "./admin-usage-metrics.ts";

test("admin usage rows include V2 step results that have no ai_request row", () => {
  const aiRequests = [];
  const orphanResults = [
    {
      executionRun: { userId: "user-1" },
      provider: "openai",
      model: "gpt-5.4-mini",
      estimatedCost: 0.12,
      tokenUsagePrompt: 700,
      tokenUsageCompletion: 291,
    },
  ];

  assert.deepEqual(mergeProviderUsageRows({ aiRequests, orphanResults }), [
    {
      label: "openai",
      requests: 1,
      estimatedCost: 0.12,
      inputTokens: 700,
      outputTokens: 291,
    },
  ]);
  assert.deepEqual(mergeModelUsageRows({ aiRequests, orphanResults }), [
    {
      label: "openai/gpt-5.4-mini",
      requests: 1,
      estimatedCost: 0.12,
      inputTokens: 700,
      outputTokens: 291,
    },
  ]);
});

test("admin user cost rows merge ai_requests and orphan V2 result usage", () => {
  const rows = mergeUserCostRows({
    aiRequests: [
      {
        userId: "user-1",
        provider: "anthropic",
        model: "claude-sonnet-4.5",
        requests: 2,
        estimatedCost: 0.3,
        inputTokens: 100,
        outputTokens: 50,
      },
    ],
    orphanResults: [
      {
        executionRun: { userId: "user-1" },
        provider: "openai",
        model: "gpt-5.4-mini",
        estimatedCost: 0.2,
        tokenUsagePrompt: 400,
        tokenUsageCompletion: 200,
      },
    ],
    usersById: new Map([["user-1", { email: "user@example.com", name: null }]]),
    take: 5,
    includeTokens: true,
  });

  assert.deepEqual(rows, [
    {
      label: "user@example.com",
      requests: 3,
      estimatedCost: 0.5,
      inputTokens: 500,
      outputTokens: 250,
    },
  ]);
});

test("admin user activity summaries expose credits tokens latest use and recent tasks", () => {
  const baseRows = [
    {
      id: "user-a",
      email: "alpha@example.com",
      name: "Alpha",
      createdAt: new Date("2026-06-19T00:00:00.000Z"),
      lastActiveAt: new Date("2026-06-19T01:00:00.000Z"),
    },
    {
      id: "user-b",
      email: "beta@example.com",
      name: "Beta",
      createdAt: new Date("2026-06-18T00:00:00.000Z"),
      lastActiveAt: new Date("2026-06-18T01:00:00.000Z"),
    },
  ];

  const summaries = buildUserActivitySummaries({
    users: baseRows,
    usageLogs: [
      {
        id: "usage-a-1",
        userId: "user-a",
        requestType: "sequential",
        selectedModels: ["openai/gpt-5.4-mini", "anthropic/claude-sonnet-4.5"],
        creditsUsed: 7,
        inputTokenCount: 1100,
        outputTokenCount: 450,
        estimatedCostUsd: 0.42,
        createdAt: new Date("2026-06-20T05:00:00.000Z"),
      },
      {
        id: "usage-b-1",
        userId: "user-b",
        requestType: "compare",
        selectedModels: ["google/gemini-3-pro-preview"],
        creditsUsed: 3,
        inputTokenCount: 800,
        outputTokenCount: 200,
        estimatedCostUsd: 0.12,
        createdAt: new Date("2026-06-20T06:00:00.000Z"),
      },
    ],
    executionRuns: [
      {
        id: "run-a-1",
        userId: "user-a",
        status: "completed",
        requestType: "sequential",
        mode: "sequential",
        totalStepsDone: 2,
        totalStepsPlanned: 2,
        createdAt: new Date("2026-06-20T04:59:00.000Z"),
        updatedAt: new Date("2026-06-20T05:01:00.000Z"),
        finishedAt: new Date("2026-06-20T05:01:00.000Z"),
      },
      {
        id: "run-b-1",
        userId: "user-b",
        status: "running",
        requestType: "compare",
        mode: "parallel",
        totalStepsDone: 1,
        totalStepsPlanned: 3,
        createdAt: new Date("2026-06-20T07:00:00.000Z"),
        updatedAt: new Date("2026-06-20T07:03:00.000Z"),
        finishedAt: null,
      },
    ],
  });

  assert.deepEqual(summaries.get("user-a"), {
    totalTaskCount: 1,
    completedTaskCount: 1,
    activeTaskCount: 0,
    totalCreditsUsed: 7,
    totalInputTokens: 1100,
    totalOutputTokens: 450,
    totalEstimatedCostUsd: 0.42,
    lastUsageAt: new Date("2026-06-20T05:01:00.000Z"),
    recentTasks: [
      {
        id: "usage-a-1",
        requestType: "sequential",
        status: "completed",
        models: ["openai/gpt-5.4-mini", "anthropic/claude-sonnet-4.5"],
        creditsUsed: 7,
        inputTokens: 1100,
        outputTokens: 450,
        estimatedCostUsd: 0.42,
        createdAt: new Date("2026-06-20T05:00:00.000Z"),
      },
    ],
  });

  assert.deepEqual(
    sortUserActivitySummaries(baseRows, summaries, "credits").map((row) => row.id),
    ["user-a", "user-b"],
  );
  assert.deepEqual(
    sortUserActivitySummaries(baseRows, summaries, "latest").map((row) => row.id),
    ["user-b", "user-a"],
  );
});
