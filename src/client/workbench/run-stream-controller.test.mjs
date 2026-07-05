import test from "node:test";
import assert from "node:assert/strict";

import { RunStreamController } from "./run-stream-controller.ts";

test("starting a new stream aborts the previous controller", () => {
  const streams = new RunStreamController();
  const first = streams.start();
  const second = streams.start();

  assert.equal(first.signal.aborted, true);
  assert.equal(second.signal.aborted, false);
});

test("clearing an old controller does not clear the active stream", () => {
  const streams = new RunStreamController();
  const first = streams.start();
  const second = streams.start();
  streams.clear(first);

  streams.abort();
  assert.equal(second.signal.aborted, true);
});
