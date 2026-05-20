export function estimateStepDurationMs(step: {
  targetModel: string;
  sourceMode: string;
}) {
  const model = step.targetModel.toLowerCase();

  if (step.sourceMode === "all_results") {
    return 120_000;
  }
  if (model.includes("opus")) {
    return 180_000;
  }
  if (model.includes("sonnet")) {
    return 120_000;
  }
  if (model.includes("gpt-5.5")) {
    return 150_000;
  }
  if (model.includes("gpt-5.4")) {
    return 120_000;
  }
  if (model.includes("mini") || model.includes("haiku")) {
    return 30_000;
  }

  return 90_000;
}

export function canInlineContinue(step: {
  targetModel: string;
  sourceMode: string;
}) {
  const model = step.targetModel.toLowerCase();

  if (step.sourceMode === "all_results") {
    return false;
  }
  if (model.includes("opus")) {
    return false;
  }
  if (model.includes("sonnet")) {
    return false;
  }

  return true;
}
