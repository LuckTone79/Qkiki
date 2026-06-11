import test from "node:test";
import assert from "node:assert/strict";

import { getRunStreamRetryDelayMs } from "./run-stream-backoff.ts";

test("run stream retry starts at the base delay", () => {
  assert.equal(getRunStreamRetryDelayMs(0), 350);
});

test("run stream retry backs off and stays bounded", () => {
  assert.equal(getRunStreamRetryDelayMs(1), 700);
  assert.equal(getRunStreamRetryDelayMs(2), 1400);
  assert.equal(getRunStreamRetryDelayMs(3), 2000);
  assert.equal(getRunStreamRetryDelayMs(10), 2000);
});

test("negative attempts are treated as the first attempt", () => {
  assert.equal(getRunStreamRetryDelayMs(-1), 350);
});
