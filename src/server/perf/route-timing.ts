import {
  appendServerTiming,
  measureTiming,
  type ServerTimingEntry,
} from "@/server/perf/server-timing";
import {
  appendQueryCounterTiming,
  createQueryCounter,
  measureQueryTiming,
} from "@/server/perf/query-counter";

export function createRouteTiming() {
  const entries: ServerTimingEntry[] = [];
  const queryCounter = createQueryCounter();

  return {
    time<T>(name: string, fn: () => Promise<T>, desc?: string) {
      return measureTiming(entries, name, fn, desc);
    },
    query<T>(name: string, fn: () => Promise<T>, desc?: string) {
      return measureQueryTiming(entries, queryCounter, name, fn, desc);
    },
    response(response: Response) {
      appendQueryCounterTiming(entries, queryCounter);
      return appendServerTiming(response, entries);
    },
  };
}
