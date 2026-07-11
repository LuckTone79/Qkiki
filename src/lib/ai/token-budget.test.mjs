import test from "node:test";
import assert from "node:assert/strict";

import {
  estimatePromptBlocksTokens,
  fitPromptBlocksToBudget,
} from "./token-budget.ts";

test("token-budget trims older competing context before the latest handoff", () => {
  const latestHandoff = "LATEST ".repeat(1200).trim();
  const fitted = fitPromptBlocksToBudget({
    model: "gpt-5.5",
    reservedOutputTokens: 124_000,
    blocks: [
      {
        key: "base",
        priority: "highest",
        text: "Base instructions ".repeat(200),
        protected: true,
      },
      {
        key: "latest",
        priority: "highest",
        text: latestHandoff,
      },
      {
        key: "older",
        priority: "medium",
        text: "OLDER ".repeat(8000).trim(),
      },
    ],
  });

  const latestBlock = fitted.blocks.find((block) => block.key === "latest");
  const olderBlock = fitted.blocks.find((block) => block.key === "older");

  assert.equal(estimatePromptBlocksTokens(fitted.blocks), fitted.estimatedInputTokens);
  assert.equal(fitted.estimatedInputTokens <= fitted.tokenBudget, true);
  assert.equal(estimatePromptBlocksTokens(fitted.blocks) <= fitted.tokenBudget, true);
  assert.equal(latestBlock?.text, latestHandoff);
  assert.match(olderBlock?.text ?? "", /\[Truncated for token budget\]/);
});

test("token-budget still ends within budget after last-resort shrinking", () => {
  const fitted = fitPromptBlocksToBudget({
    model: "gpt-5.5",
    reservedOutputTokens: 124_000,
    blocks: [
      {
        key: "base",
        priority: "highest",
        text: "BASE ".repeat(4000).trim(),
        protected: true,
      },
      {
        key: "latest",
        priority: "highest",
        text: "LATEST ".repeat(5000).trim(),
        protected: true,
      },
    ],
  });

  assert.equal(estimatePromptBlocksTokens(fitted.blocks), fitted.estimatedInputTokens);
  assert.equal(fitted.estimatedInputTokens <= fitted.tokenBudget, true);
  assert.equal(estimatePromptBlocksTokens(fitted.blocks) <= fitted.tokenBudget, true);
  assert.match(fitted.blocks[0].text, /BASE|Truncated/);
  assert.match(fitted.blocks[1].text, /LATEST|Truncated/);
});

test("token-budget stays within budget when many minimum-size blocks must be dropped and shrunk", () => {
  const tinyText = "A".repeat(30);
  const blocks = [
    ...Array.from({ length: 400 }, (_, index) => ({
      key: `optional-${index}`,
      priority: index % 2 === 0 ? "low" : "medium",
      text: tinyText,
    })),
    ...Array.from({ length: 600 }, (_, index) => ({
      key: `protected-${index}`,
      priority: "highest",
      protected: true,
      text: tinyText,
    })),
  ];

  const fitted = fitPromptBlocksToBudget({
    model: "gpt-5.5",
    reservedOutputTokens: 124_000,
    blocks,
  });

  assert.equal(estimatePromptBlocksTokens(fitted.blocks), fitted.estimatedInputTokens);
  assert.equal(fitted.estimatedInputTokens <= fitted.tokenBudget, true);
});
