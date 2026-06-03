import test from "node:test";
import assert from "node:assert/strict";

import { copyTextToClipboard } from "./browser-clipboard.ts";

test("copyTextToClipboard reports success when the Clipboard API accepts the text", async () => {
  const writes = [];

  const result = await copyTextToClipboard("https://example.test/shared/token", {
    navigator: {
      clipboard: {
        writeText: async (value) => {
          writes.push(value);
        },
      },
    },
  });

  assert.equal(result.copied, true);
  assert.deepEqual(writes, ["https://example.test/shared/token"]);
});

test("copyTextToClipboard does not throw when the browser blocks clipboard access", async () => {
  const result = await copyTextToClipboard("https://example.test/shared/token", {
    navigator: {
      clipboard: {
        writeText: async () => {
          throw new DOMException(
            "The request is not allowed by the user agent or the platform in the current context.",
            "NotAllowedError",
          );
        },
      },
    },
  });

  assert.equal(result.copied, false);
  assert.equal(result.reason, "blocked");
});

test("copyTextToClipboard reports unsupported when the Clipboard API is unavailable", async () => {
  const result = await copyTextToClipboard("https://example.test/shared/token", {
    navigator: {},
  });

  assert.equal(result.copied, false);
  assert.equal(result.reason, "unsupported");
});
