import test from "node:test";
import assert from "node:assert/strict";

import {
  CREDIT_RISK_MULTIPLIER,
  costUsdToCredits,
  estimateComparisonSummaryCredits,
  estimateImageGenerationCostUsd,
  estimateOutputTokensForAction,
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

test("image generation models use per-image pricing and zero text output tokens", () => {
  const estimate = estimateWorkbenchRunCredits({
    mode: "parallel",
    originalInput: "Create a product mockup image for a pricing dashboard.",
    additionalInstruction: "Square format, clean UI style.",
    targets: [{ provider: "openai", model: "gpt-image-2" }],
  });
  const [line] = estimate.callBreakdown;
  const rawCostUsd = estimateImageGenerationCostUsd({
    provider: "openai",
    model: "gpt-image-2",
  });

  assert.equal(rawCostUsd, 0.053);
  assert.equal(line.billingKind, "image");
  assert.equal(line.unitCount, 1);
  assert.equal(line.unitLabel, "image");
  assert.equal(line.outputTokens, 0);
  assert.equal(line.rawCostUsd, rawCostUsd);
  assert.equal(line.credits, costUsdToCredits(rawCostUsd));
  assert.equal(estimate.estimatedCredits, line.credits);
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

test("repeated image generation steps scale by generated image count", () => {
  const estimate = estimateWorkbenchRunCredits({
    mode: "sequential",
    originalInput: "Generate campaign visuals.",
    additionalInstruction: "",
    steps: [
      {
        orderIndex: 1,
        actionType: "generate",
        targetProvider: "google",
        targetModel: "imagen-4.0-generate-001",
        sourceMode: "original",
      },
    ],
    workflowControl: {
      repeatBlocks: [{ startStepOrder: 1, endStepOrder: 1, repeatCount: 3 }],
    },
  });

  assert.equal(estimate.plannedCallCount, 3);
  assert.equal(
    estimate.callBreakdown.every((line) => line.billingKind === "image"),
    true,
  );
  assert.equal(
    estimate.estimatedCredits,
    costUsdToCredits(0.04) * 3,
  );
});

test("code review output estimate allows findings plus complete improved code", () => {
  assert.equal(estimateOutputTokensForAction("code_review"), 2600);
});

test("scenario and deep-dive output estimates match their structured protocols", () => {
  assert.equal(estimateOutputTokensForAction("scenario_develop"), 3000);
  assert.equal(estimateOutputTokensForAction("deep_dive"), 2400);
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
