type ResultLike = {
  id: string;
};

export type ResultExpansionMap = Record<string, boolean>;

export function buildCollapsedResultExpansionMap<T extends ResultLike>(
  results: T[],
): ResultExpansionMap {
  return Object.fromEntries(results.map((result) => [result.id, false]));
}

export function mergeResultExpansionMap<T extends ResultLike>(
  current: ResultExpansionMap,
  results: T[],
): ResultExpansionMap {
  return Object.fromEntries(
    results.map((result) => [result.id, current[result.id] ?? false]),
  );
}

export function setAllResultsExpanded<T extends ResultLike>(
  results: T[],
  expanded: boolean,
): ResultExpansionMap {
  return Object.fromEntries(results.map((result) => [result.id, expanded]));
}
