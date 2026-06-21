import test from "node:test";
import assert from "node:assert/strict";

import {
  mergeModelUsageRows,
  mergeProviderUsageRows,
  mergeUserCostRows,
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
