export type WorkbenchMobilePanel = "models" | "input" | "workflow" | "results";

export const NEW_WORKBENCH_EVENT = "qkiki:new-workbench-request";

export function buildNewWorkbenchPath() {
  return "/app/workbench?new=1";
}

export function buildSharedSessionPath(token: string) {
  return `/shared/${encodeURIComponent(token)}`;
}

export function buildSharedResultPath(token: string, resultId: string) {
  return `${buildSharedSessionPath(token)}?result=${encodeURIComponent(resultId)}`;
}

export function buildResultDomId(resultId: string) {
  return `result-${resultId}`;
}

export function buildWorkbenchMobilePanels(input: {
  mode: "parallel" | "sequential";
  resultsCount: number;
}) {
  const resultsLabel =
    input.resultsCount > 0
      ? `results:${input.resultsCount}`
      : "results";

  if (input.mode === "parallel") {
    return [
      { id: "models" as const, label: "models" },
      { id: "input" as const, label: "input" },
      { id: "results" as const, label: resultsLabel },
    ];
  }

  return [
    { id: "input" as const, label: "input" },
    { id: "workflow" as const, label: "workflow" },
    { id: "results" as const, label: resultsLabel },
  ];
}
