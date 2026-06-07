export type WorkbenchProviderSelection = {
  enabled: boolean;
  models: string[];
};

export function nextProviderSelectionForEnabledChange(
  selection: WorkbenchProviderSelection,
  defaultModel: string,
  enabled: boolean,
): WorkbenchProviderSelection {
  if (!enabled) {
    return {
      enabled: false,
      models: [],
    };
  }

  return {
    enabled: true,
    models: selection.models.length ? selection.models : [defaultModel],
  };
}
