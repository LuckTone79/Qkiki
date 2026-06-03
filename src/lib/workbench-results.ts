type ResultLike = {
  id: string;
  parentResultId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type WorkbenchMode = "parallel" | "sequential";

function sortByCreatedAt<T extends ResultLike>(items: T[]) {
  return [...items].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function buildResultDepthMap<T extends ResultLike>(results: T[]) {
  const byId = new Map(results.map((result) => [result.id, result]));
  const depthMap = new Map<string, number>();

  const depthOf = (result: T): number => {
    if (depthMap.has(result.id)) {
      return depthMap.get(result.id) ?? 0;
    }

    const parent = result.parentResultId ? byId.get(result.parentResultId) : null;
    const depth = parent ? depthOf(parent) + 1 : 0;
    depthMap.set(result.id, depth);
    return depth;
  };

  results.forEach(depthOf);
  return depthMap;
}

export function pickDisplayFinalResultId<T extends Pick<ResultLike, "id" | "status">>(
  results: T[],
  finalResultId: string | null,
) {
  const explicitFinal = results.find(
    (result) => result.id === finalResultId && result.status === "completed",
  );
  return explicitFinal?.id ?? null;
}

export function sortResultsForDisplay<T extends ResultLike>(
  results: T[],
  mode: WorkbenchMode,
) {
  if (mode !== "parallel") {
    return sortByCreatedAt(results);
  }

  const childrenByParent = new Map<string, T[]>();
  const roots: T[] = [];

  for (const result of results) {
    if (!result.parentResultId) {
      roots.push(result);
      continue;
    }

    const siblings = childrenByParent.get(result.parentResultId) ?? [];
    siblings.push(result);
    childrenByParent.set(result.parentResultId, siblings);
  }

  const rootCompletionRank = (result: T) => {
    if (
      result.status === "completed" ||
      result.status === "failed" ||
      result.status === "canceled" ||
      result.status === "skipped"
    ) {
      return 0;
    }

    if (result.status === "running") {
      return 1;
    }

    return 2;
  };

  const sortedRoots = [...roots].sort((a, b) => {
    const rankDiff = rootCompletionRank(a) - rootCompletionRank(b);
    if (rankDiff !== 0) {
      return rankDiff;
    }

    const updatedDiff =
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    if (updatedDiff !== 0) {
      return updatedDiff;
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const ordered: T[] = [];
  const appendBranch = (result: T) => {
    ordered.push(result);

    const children = sortByCreatedAt(childrenByParent.get(result.id) ?? []);
    for (const child of children) {
      appendBranch(child);
    }
  };

  for (const root of sortedRoots) {
    appendBranch(root);
  }

  return ordered;
}

export function prioritizePinnedResults<T extends Pick<ResultLike, "id">>(
  results: T[],
  pinnedIds: Array<string | null | undefined>,
) {
  const orderedPinnedIds = Array.from(
    new Set(pinnedIds.filter((id): id is string => Boolean(id))),
  );
  const pinned = orderedPinnedIds
    .map((id) => results.find((result) => result.id === id))
    .filter((result): result is T => Boolean(result));
  const pinnedSet = new Set(pinned.map((result) => result.id));

  return [
    ...pinned,
    ...results.filter((result) => !pinnedSet.has(result.id)),
  ];
}

export function prioritizePinnedRootBranches<T extends ResultLike>(
  results: T[],
  pinnedIds: Array<string | null | undefined>,
) {
  const byId = new Map(results.map((result) => [result.id, result]));
  const childrenByParent = new Map<string, T[]>();

  results.forEach((result) => {
    if (!result.parentResultId) {
      return;
    }

    const children = childrenByParent.get(result.parentResultId) ?? [];
    children.push(result);
    childrenByParent.set(result.parentResultId, children);
  });

  const pinnedSet = new Set<string>();
  const pinnedBranches: T[] = [];

  const rootOf = (result: T) => {
    let current = result;
    while (current.parentResultId && byId.has(current.parentResultId)) {
      current = byId.get(current.parentResultId) ?? current;
    }
    return current;
  };

  const appendSubtree = (result: T | undefined) => {
    if (!result) {
      return;
    }

    if (!pinnedSet.has(result.id)) {
      pinnedBranches.push(result);
      pinnedSet.add(result.id);
    }

    (childrenByParent.get(result.id) ?? []).forEach(appendSubtree);
  };

  Array.from(new Set(pinnedIds.filter((id): id is string => Boolean(id))))
    .map((id) => byId.get(id))
    .filter((result): result is T => Boolean(result))
    .map(rootOf)
    .forEach(appendSubtree);

  return [
    ...pinnedBranches,
    ...results.filter((result) => !pinnedSet.has(result.id)),
  ];
}

export function partitionResultsForWorkbench<T extends ResultLike>(results: T[]) {
  return {
    mainResults: results.filter((result) => result.parentResultId === null),
    branchResults: results.filter((result) => result.parentResultId !== null),
  };
}
