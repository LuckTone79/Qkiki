import test from "node:test";
import assert from "node:assert/strict";

import { buildRunnerMetricEvent } from "./runner-metrics.ts";

test("runner metrics use stable dimensions and bounded duration", () => {
  assert.deepEqual(
    buildRunnerMetricEvent({
      metric: "kickoff",
      runnerVersion: "v2",
      mode: "sequential",
      executionRunId: "run-1",
      startedAtMs: 150,
      finishedAtMs: 100,
    }),
    {
      event: "workbench_runner_metric",
      metric: "kickoff",
      runnerVersion: "v2",
      mode: "sequential",
      executionRunId: "run-1",
      durationMs: 0,
    },
  );
});
