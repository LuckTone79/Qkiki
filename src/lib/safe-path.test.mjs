import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeInternalPath } from "./safe-path.ts";

const options = { fallback: "/app/workbench", allowedPrefixes: ["/app"] };

test("safe internal paths retain their query string", () => {
  assert.equal(
    sanitizeInternalPath("/app/workbench?trial=true", options),
    "/app/workbench?trial=true",
  );
});

test("host-confusion and separator payloads fall back", () => {
  for (const value of [
    "https://example.com",
    "//example.com",
    "/\\\\example.com",
    "/\t/example.com",
    "/app/%2f%2fevil.example",
    "/app/%5cevil.example",
    "/application",
  ]) {
    assert.equal(sanitizeInternalPath(value, options), options.fallback, value);
  }
});
