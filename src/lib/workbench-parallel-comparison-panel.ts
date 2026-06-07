export type ParallelComparisonPanelState = {
  collapsed: boolean;
  detached: boolean;
};

export function createParallelComparisonPanelState(): ParallelComparisonPanelState {
  return {
    collapsed: false,
    detached: false,
  };
}

export function toggleParallelComparisonPanelCollapsed(
  current: ParallelComparisonPanelState,
): ParallelComparisonPanelState {
  return {
    ...current,
    collapsed: !current.collapsed,
  };
}

export function openDetachedParallelComparisonPanel(
  current: ParallelComparisonPanelState,
): ParallelComparisonPanelState {
  return {
    ...current,
    collapsed: false,
    detached: true,
  };
}

export function closeDetachedParallelComparisonPanel(
  current: ParallelComparisonPanelState,
): ParallelComparisonPanelState {
  return {
    ...current,
    detached: false,
  };
}
