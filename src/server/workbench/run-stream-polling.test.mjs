import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRunStreamCursor,
  getRunStreamPollDelayMs,
} from "./run-stream-polling.ts";

test("run stream cursor changes when run or step state changes", () => {
  const base = {
    status: "running",
    runUpdatedAt: new Date("2026-07-06T12:00:00.000Z"),
    stepUpdatedAt: new Date("2026-07-06T12:00:01.000Z"),
    stepCount: 2,
  };
  const initial = buildRunStreamCursor(base);

  assert.equal(buildRunStreamCursor(base), initial);
  assert.notEqual(
    buildRunStreamCursor({ ...base, stepCount: 3 }),
    initial,
  );
  assert.notEqual(
    buildRunStreamCursor({
      ...base,
      stepUpdatedAt: new Date("2026-07-06T12:00:02.000Z"),
    }),
    initial,
  );
});

test("unchanged stream polls back off gradually and stay bounded", () => {
  assert.equal(getRunStreamPollDelayMs(0), 1000);
  assert.equal(getRunStreamPollDelayMs(1), 1000);
  assert.equal(getRunStreamPollDelayMs(2), 1500);
  assert.equal(getRunStreamPollDelayMs(4), 2500);
  assert.equal(getRunStreamPollDelayMs(20), 3000);
});
