import "server-only";

import type { Prisma } from "@prisma/client";
import { ensureWorkbenchRunSchema } from "@/lib/workbench-run-schema";

export async function ensureWorkbenchResultReadSchema() {
  return ensureWorkbenchRunSchema();
}

export function buildWorkbenchResultSelect(
  input: {
    includePromptSnapshot?: boolean;
    includeOutputText?: boolean;
    includeEncryptedOutput?: boolean;
    includeRawResponse?: boolean;
    includeBranching?: boolean;
    includeUsage?: boolean;
    includeExecutionFields?: boolean;
    includeTimestamps?: boolean;
    includeWorkflowStep?: boolean;
  } = {},
) {
  const select = {
    id: true,
    provider: true,
    model: true,
    status: true,
    errorMessage: true,
    ...(input.includePromptSnapshot ? { promptSnapshot: true } : {}),
    ...(input.includeOutputText ? { outputText: true } : {}),
    ...(input.includeEncryptedOutput
      ? {
          outputTextCiphertext: true,
          outputTextIv: true,
          outputTextTag: true,
        }
      : {}),
    ...(input.includeRawResponse ? { rawResponse: true } : {}),
    ...(input.includeBranching
      ? {
          workflowStepId: true,
          parentResultId: true,
          branchKey: true,
        }
      : {}),
    ...(input.includeUsage
      ? {
          tokenUsagePrompt: true,
          tokenUsageCompletion: true,
          estimatedCost: true,
          costIsEstimated: true,
          latencyMs: true,
        }
      : {}),
    ...(input.includeExecutionFields
      ? {
          executionRunId: true,
          executionOrder: true,
        }
      : {}),
    ...(input.includeTimestamps
      ? {
          createdAt: true,
          updatedAt: true,
        }
      : {}),
    ...(input.includeWorkflowStep
      ? {
          workflowStep: {
            select: { orderIndex: true, actionType: true },
          },
          executionRunStep: {
            select: {
              orderIndex: true,
              templateStepIndex: true,
              repeatIteration: true,
              actionType: true,
              targetProvider: true,
              targetModel: true,
              sourceMode: true,
              sourceResultId: true,
              status: true,
            },
          },
        }
      : {}),
  } satisfies Prisma.ResultSelect;

  return select;
}
