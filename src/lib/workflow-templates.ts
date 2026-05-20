import "server-only";

import type { Prisma } from "@prisma/client";
import type { WorkflowStepInput } from "@/lib/ai/types";
import { prisma } from "@/lib/prisma";

export async function syncWorkflowTemplateSteps(
  tx: Prisma.TransactionClient,
  input: {
    sessionId: string;
    steps: WorkflowStepInput[];
  },
) {
  await tx.workflowStep.deleteMany({
    where: { sessionId: input.sessionId },
  });

  if (!input.steps.length) {
    return [];
  }

  await tx.workflowStep.createMany({
    data: input.steps.map((step) => ({
      sessionId: input.sessionId,
      orderIndex: step.orderIndex,
      actionType: step.actionType,
      targetProvider: step.targetProvider,
      targetModel: step.targetModel,
      sourceMode: step.sourceMode,
      sourceResultId: step.sourceResultId ?? null,
      instructionTemplate: step.instructionTemplate ?? null,
    })),
  });

  return tx.workflowStep.findMany({
    where: { sessionId: input.sessionId },
    orderBy: { orderIndex: "asc" },
  });
}

export async function replaceWorkflowTemplateSteps(input: {
  sessionId: string;
  steps: WorkflowStepInput[];
}) {
  return prisma.$transaction((tx) =>
    syncWorkflowTemplateSteps(tx, input),
  );
}
