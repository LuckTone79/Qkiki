import test from "node:test";
import assert from "node:assert/strict";

import {
  buildServerTimingHeader,
  createServerTiming,
  isPerfTraceEnabled,
} from "./server-timing.ts";

test("performance tracing is opt-in", () => {
  assert.equal(isPerfTraceEnabled({}), false);
  assert.equal(isPerfTraceEnabled({ PERF_TRACE: "0" }), false);
  assert.equal(isPerfTraceEnabled({ PERF_TRACE: "1" }), true);
});

test("server timing serializes safe names descriptions and durations", () => {
  assert.equal(
    buildServerTimingHeader([
      { name: "auth lookup", durationMs: 12.345, description: 'user "lookup"' },
      { name: "main", durationMs: -2 },
    ]),
    'auth_lookup;dur=12.3;desc="user \'lookup\'", main;dur=0',
  );
});

test("disabled timing does not add a response header", async () => {
  const timing = createServerTiming({ PERF_TRACE: "0" });
  assert.equal(await timing.measure("auth", async () => "ok"), "ok");
  const headers = new Headers();
  timing.apply(headers);
  assert.equal(headers.has("Server-Timing"), false);
});
