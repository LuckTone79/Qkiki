export type WorkbenchProviderFallbackMode = "parallel" | "sequential";

export function shouldAllowConfiguredProviderFallback(
  mode: WorkbenchProviderFallbackMode,
) {
  return mode === "parallel";
}
