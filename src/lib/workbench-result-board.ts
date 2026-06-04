type ResultBoardItem = {
  id: string;
  parentResultId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  provider?: string | null;
  model?: string | null;
  outputText?: string | null;
  errorMessage?: string | null;
  searchTokens?: Array<string | null | undefined>;
};

export type ResultBoardFilter = "all" | "final" | "failed" | "main" | "branch";
export type ResultBoardSort = "workflow" | "latest" | "oldest" | "failed_first";

type ResultBoardOptions = {
  filter: ResultBoardFilter;
  sort: ResultBoardSort;
  query: string;
  finalResultId?: string | null;
};

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

function isFailedLike(status: string) {
  return status === "failed" || status === "canceled" || status === "skipped";
}

function compareDateDesc(left: string, right: string) {
  return new Date(right).getTime() - new Date(left).getTime();
}

function compareDateAsc(left: string, right: string) {
  return new Date(left).getTime() - new Date(right).getTime();
}

function matchesQuery<T extends ResultBoardItem>(result: T, query: string) {
  if (!query) {
    return true;
  }

  const haystack = [
    result.id,
    result.status,
    result.provider ?? "",
    result.model ?? "",
    result.outputText ?? "",
    result.errorMessage ?? "",
    ...(result.searchTokens ?? []),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function matchesFilter<T extends ResultBoardItem>(
  result: T,
  filter: ResultBoardFilter,
  finalResultId: string | null | undefined,
) {
  if (filter === "final") {
    return result.id === finalResultId;
  }

  if (filter === "failed") {
    return isFailedLike(result.status);
  }

  if (filter === "main") {
    return result.parentResultId === null;
  }

  if (filter === "branch") {
    return result.parentResultId !== null;
  }

  return true;
}

function sortResults<T extends ResultBoardItem>(results: T[], sort: ResultBoardSort) {
  if (sort === "workflow") {
    return [...results];
  }

  if (sort === "latest") {
    return [...results].sort((left, right) => {
      const updatedDiff = compareDateDesc(left.updatedAt, right.updatedAt);
      if (updatedDiff !== 0) {
        return updatedDiff;
      }

      return compareDateDesc(left.createdAt, right.createdAt);
    });
  }

  if (sort === "oldest") {
    return [...results].sort((left, right) => {
      const createdDiff = compareDateAsc(left.createdAt, right.createdAt);
      if (createdDiff !== 0) {
        return createdDiff;
      }

      return compareDateAsc(left.updatedAt, right.updatedAt);
    });
  }

  return [...results].sort((left, right) => {
    const rankDiff =
      Number(isFailedLike(right.status)) - Number(isFailedLike(left.status));
    if (rankDiff !== 0) {
      return rankDiff;
    }

    return compareDateDesc(left.updatedAt, right.updatedAt);
  });
}

export function buildResultBoardView<T extends ResultBoardItem>(
  results: T[],
  options: ResultBoardOptions,
) {
  const query = normalizeQuery(options.query);

  const filtered = results.filter(
    (result) =>
      matchesFilter(result, options.filter, options.finalResultId) &&
      matchesQuery(result, query),
  );

  return sortResults(filtered, options.sort);
}
