export type ServerTimingEntry = {
  name: string;
  durationMs: number;
  description?: string;
};

type PerfTraceEnvironment = Readonly<Record<string, string | undefined>>;

function safeTimingName(name: string) {
  const normalized = name.trim().replace(/[^a-zA-Z0-9_.-]+/g, "_");
  return normalized || "timing";
}

export function isPerfTraceEnabled(
  environment: PerfTraceEnvironment = process.env,
) {
  return environment.PERF_TRACE?.trim() === "1";
}

export function buildServerTimingHeader(entries: ServerTimingEntry[]) {
  return entries
    .map((entry) => {
      const durationMs = Math.max(
        0,
        Math.round(entry.durationMs * 10) / 10,
      );
      const description = entry.description
        ? `;desc="${entry.description.replaceAll('"', "'")}"`
        : "";
      return `${safeTimingName(entry.name)};dur=${durationMs}${description}`;
    })
    .join(", ");
}

export function createServerTiming(
  environment: PerfTraceEnvironment = process.env,
) {
  const enabled = isPerfTraceEnabled(environment);
  const entries: ServerTimingEntry[] = [];

  return {
    async measure<T>(
      name: string,
      operation: () => Promise<T>,
      description?: string,
    ) {
      if (!enabled) {
        return operation();
      }

      const startedAt = performance.now();
      try {
        return await operation();
      } finally {
        entries.push({
          name,
          durationMs: performance.now() - startedAt,
          description,
        });
      }
    },
    apply(headers: Headers) {
      if (!enabled || entries.length === 0) {
        return;
      }
      headers.set("Server-Timing", buildServerTimingHeader(entries));
    },
  };
}
