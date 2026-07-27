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
  if (model.includes("fable")) {
    return 240_000;
  }
  if (model.includes("sonnet")) {
    return 120_000;
  }
  if (model.includes("gpt-5.5-pro") || model.includes("gpt-5.4-pro")) {
    return 300_000;
  }
  if (model.includes("gpt-5.6-sol") || model === "gpt-5.5") {
    return 180_000;
  }
  if (model.includes("gpt-5.6-terra") || model === "gpt-5.4" || model.includes("grok-4.5")) {
    return 150_000;
  }
  if (model.includes("gpt-5.6-luna") || model.includes("gpt-5.4-mini")) {
    return 120_000;
  }
  if (model.includes("nano") || model.includes("mini") || model.includes("haiku") || model.includes("flash-lite")) {
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
  if (model.includes("fable")) {
    return false;
  }
  if (model.includes("sonnet")) {
    return false;
  }

  return true;
}
