import test from "node:test";
import assert from "node:assert/strict";

import {
  appendServerTiming,
  buildServerTiming,
  measureTiming,
} from "./server-timing.ts";
import {
  appendQueryCounterTiming,
  createQueryCounter,
  measureQueryTiming,
} from "./query-counter.ts";

test("buildServerTiming formats duration and escaped descriptions", () => {
  const header = buildServerTiming([
    { name: "auth", dur: 12.34, desc: 'lookup "session"' },
    { name: "main", dur: 2 },
  ]);

  assert.equal(header, 'auth;dur=12.3;desc="lookup \'session\'", main;dur=2');
});

test("appendServerTiming only sets the header when perf tracing is enabled", () => {
  const disabled = appendServerTiming(
    new Response("ok"),
    [{ name: "auth", dur: 1 }],
    { PERF_TRACE: "0" },
  );
  assert.equal(disabled.headers.get("Server-Timing"), null);

  const enabled = appendServerTiming(
    new Response("ok"),
    [{ name: "auth", dur: 1 }],
    { PERF_TRACE: "1" },
  );
  assert.equal(enabled.headers.get("Server-Timing"), "auth;dur=1");
});

test("measureTiming records duration even when the measured function throws", async () => {
  const entries = [];

  await assert.rejects(
    () =>
      measureTiming(entries, "boom", async () => {
        throw new Error("failed");
      }),
    /failed/,
  );

  assert.equal(entries.length, 1);
  assert.equal(entries[0].name, "boom");
  assert.equal(typeof entries[0].dur, "number");
});

test("query counter tracks measured database sections", async () => {
  const entries = [];
  const counter = createQueryCounter();

  const result = await measureQueryTiming(entries, counter, "sessions", async () => 42);
  appendQueryCounterTiming(entries, counter);

  assert.equal(result, 42);
  assert.equal(counter.count, 1);
  assert.equal(entries[0].name, "sessions");
  assert.equal(entries[1].name, "db_ops");
  assert.equal(entries[1].dur, 1);
  assert.equal(entries[1].desc, "1 measured database section");
});
