import test from "node:test";
import assert from "node:assert/strict";

import { readNdjsonResponse } from "./run-stream-reader.ts";

test("NDJSON reader handles split chunks and a trailing line", async () => {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('{"type":"one"}\n{"type"'));
      controller.enqueue(encoder.encode(':"two"}\n\n{"type":"three"}'));
      controller.close();
    },
  });
  const events = [];

  const count = await readNdjsonResponse(
    new Response(body),
    (line) => JSON.parse(line),
    (event) => events.push(event),
  );

  assert.equal(count, 3);
  assert.deepEqual(events, [
    { type: "one" },
    { type: "two" },
    { type: "three" },
  ]);
});
