export type RunnerMetricInput = {
  metric: "kickoff" | "rescue" | "completion";
  runnerVersion: "v1" | "v2";
  mode: "parallel" | "sequential" | "image";
  executionRunId: string;
  startedAtMs: number;
  finishedAtMs?: number;
};

export function buildRunnerMetricEvent(input: RunnerMetricInput) {
  return {
    event: "workbench_runner_metric",
    metric: input.metric,
    runnerVersion: input.runnerVersion,
    mode: input.mode,
    executionRunId: input.executionRunId,
    durationMs: Math.max(
      0,
      Math.round((input.finishedAtMs ?? Date.now()) - input.startedAtMs),
    ),
  } as const;
}

export function emitRunnerMetric(input: RunnerMetricInput) {
  console.info(JSON.stringify(buildRunnerMetricEvent(input)));
}
