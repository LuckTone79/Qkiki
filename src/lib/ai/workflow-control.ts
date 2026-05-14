import type {
  WorkflowControlInput,
  WorkflowRepeatBlockInput,
  WorkflowStepInput,
} from "@/lib/ai/types";

export const MAX_TOTAL_SEQUENTIAL_STEPS = 50;
export const MAX_REPEAT_BLOCKS = 10;

export function normalizeRepeatBlocks(
  workflowControl?: WorkflowControlInput,
): WorkflowRepeatBlockInput[] {
  if (Array.isArray(workflowControl?.repeatBlocks)) {
    return workflowControl.repeatBlocks.map((block) => ({
      startStepOrder: block.startStepOrder,
      endStepOrder: block.endStepOrder,
      repeatCount: block.repeatCount,
    }));
  }

  if (workflowControl?.repeat?.enabled) {
    return [
      {
        startStepOrder: workflowControl.repeat.startStepOrder,
        endStepOrder: workflowControl.repeat.endStepOrder,
        repeatCount: workflowControl.repeat.repeatCount,
      },
    ];
  }

  return [];
}

export function expandWorkflowSteps(
  steps: WorkflowStepInput[],
  workflowControl?: WorkflowControlInput,
) {
  if (!steps.length) {
    throw new Error("At least one sequential step is required.");
  }

  const repeatBlocks = normalizeRepeatBlocks(workflowControl);
  if (!repeatBlocks.length) {
    return [...steps];
  }

  if (repeatBlocks.length > MAX_REPEAT_BLOCKS) {
    throw new Error(`You can configure up to ${MAX_REPEAT_BLOCKS} repeat blocks.`);
  }

  const expanded: WorkflowStepInput[] = [];
  let nextBaseStart = 0;

  for (const repeatBlock of repeatBlocks) {
    const startIndex = repeatBlock.startStepOrder - 1;
    const endIndex = repeatBlock.endStepOrder - 1;

    if (
      startIndex < 0 ||
      endIndex < 0 ||
      startIndex >= steps.length ||
      endIndex >= steps.length
    ) {
      throw new Error("Repeat range is out of step bounds.");
    }

    if (startIndex > endIndex) {
      throw new Error("Repeat start step must be before or equal to end step.");
    }

    if (startIndex > nextBaseStart) {
      expanded.push(...steps.slice(nextBaseStart, startIndex));
    }

    const repeatedBlock = steps.slice(startIndex, endIndex + 1);
    for (let repeatIndex = 0; repeatIndex < repeatBlock.repeatCount; repeatIndex += 1) {
      expanded.push(...repeatedBlock);
    }

    nextBaseStart = Math.max(nextBaseStart, endIndex + 1);
  }

  if (nextBaseStart < steps.length) {
    expanded.push(...steps.slice(nextBaseStart));
  }

  if (expanded.length > MAX_TOTAL_SEQUENTIAL_STEPS) {
    throw new Error(
      `Total sequential executions cannot exceed ${MAX_TOTAL_SEQUENTIAL_STEPS}.`,
    );
  }

  return expanded;
}

export function calculateExpandedStepCount(
  steps: WorkflowStepInput[],
  workflowControl?: WorkflowControlInput,
) {
  return expandWorkflowSteps(steps, workflowControl).length;
}
