import test from "node:test";
import assert from "node:assert/strict";

import {
  CREDIT_RISK_MULTIPLIER,
  costUsdToCredits,
  estimateComparisonSummaryCredits,
  estimateWorkbenchRunCredits,
} from "./credits.ts";

const miniTarget = { provider: "openai", model: "gpt-5.4-mini" };

test("credit conversion keeps at least a 2x API-cost safety margin", () => {
  assert.ok(CREDIT_RISK_MULTIPLIER >= 2);
  assert.equal(
    costUsdToCredits(1, {
      fxRateKrwPerUsd: 1500,
      riskMultiplier: 2.1,
      protectedKrwPerCredit: 10,
    }),
    315,
  );
});

test("parallel credit estimate scales with selected target count", () => {
  const oneTarget = estimateWorkbenchRunCredits({
    mode: "parallel",
    originalInput: "검토할 긴 입력입니다.".repeat(200),
    additionalInstruction: "핵심 리스크를 찾아줘.",
    targets: [miniTarget],
  });
  const twoTargets = estimateWorkbenchRunCredits({
    mode: "parallel",
    originalInput: "검토할 긴 입력입니다.".repeat(200),
    additionalInstruction: "핵심 리스크를 찾아줘.",
    targets: [miniTarget, miniTarget],
  });

  assert.equal(oneTarget.plannedCallCount, 1);
  assert.equal(twoTargets.plannedCallCount, 2);
  assert.equal(twoTargets.estimatedCredits, oneTarget.estimatedCredits * 2);
});

test("sequential credit estimate expands repeat blocks before pricing", () => {
  const estimate = estimateWorkbenchRunCredits({
    mode: "sequential",
    originalInput: "초안".repeat(500),
    additionalInstruction: "",
    steps: [
      {
        orderIndex: 1,
        actionType: "generate",
        targetProvider: "openai",
        targetModel: "gpt-5.4-mini",
        sourceMode: "original",
      },
      {
        orderIndex: 2,
        actionType: "critique",
        targetProvider: "openai",
        targetModel: "gpt-5.4-mini",
        sourceMode: "previous",
      },
      {
        orderIndex: 3,
        actionType: "improve",
        targetProvider: "openai",
        targetModel: "gpt-5.4-mini",
        sourceMode: "previous",
      },
    ],
    workflowControl: {
      repeatBlocks: [{ startStepOrder: 2, endStepOrder: 3, repeatCount: 3 }],
    },
  });

  assert.equal(estimate.plannedCallCount, 7);
  assert.equal(estimate.callBreakdown.length, 7);
  assert.ok(estimate.estimatedCredits > 0);
});

test("comparison summary estimate is a single model call with result text risk", () => {
  const estimate = estimateComparisonSummaryCredits({
    originalInput: "비교할 원문".repeat(300),
    resultCount: 4,
    averageResultCharCount: 3500,
  });

  assert.equal(estimate.plannedCallCount, 1);
  assert.ok(estimate.estimatedCredits > 0);
  assert.ok(estimate.estimatedInputTokens > estimate.estimatedOutputTokens);
});
