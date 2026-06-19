type TimingEntry = {
  name: string;
  dur: number;
  desc?: string;
};

export type QueryCounter = {
  count: number;
};

export function createQueryCounter(): QueryCounter {
  return { count: 0 };
}

export async function measureQueryTiming<T>(
  entries: TimingEntry[],
  counter: QueryCounter,
  name: string,
  fn: () => Promise<T>,
  desc?: string,
) {
  counter.count += 1;
  const startedAt = performance.now();
  try {
    return await fn();
  } finally {
    entries.push({
      name,
      dur: Math.round((performance.now() - startedAt) * 10) / 10,
      desc,
    });
  }
}

export function appendQueryCounterTiming(
  entries: TimingEntry[],
  counter: QueryCounter,
) {
  if (counter.count === 0) {
    return;
  }

  entries.push({
    name: "db_ops",
    dur: counter.count,
    desc:
      counter.count === 1
        ? "1 measured database section"
        : `${counter.count} measured database sections`,
  });
}
