export type ServerTimingEntry = {
  name: string;
  dur: number;
  desc?: string;
};

export function isPerfTraceEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  return env.PERF_TRACE === "1";
}

export async function measureTiming<T>(
  entries: ServerTimingEntry[],
  name: string,
  fn: () => Promise<T>,
  desc?: string,
) {
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

export function buildServerTiming(entries: ServerTimingEntry[]) {
  return entries
    .map((entry) => {
      const duration = Math.round(entry.dur * 10) / 10;
      const description = entry.desc
        ? `;desc="${entry.desc.replaceAll('"', "'")}"`
        : "";
      return `${entry.name};dur=${duration}${description}`;
    })
    .join(", ");
}

export function appendServerTiming(
  response: Response,
  entries: ServerTimingEntry[],
  env: Record<string, string | undefined> = process.env,
) {
  if (isPerfTraceEnabled(env) && entries.length > 0) {
    response.headers.set("Server-Timing", buildServerTiming(entries));
  }
  return response;
}
