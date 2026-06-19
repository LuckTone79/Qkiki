import test from "node:test";
import assert from "node:assert/strict";

import { shouldLoadListOnMount } from "./initial-list-data.ts";

test("shouldLoadListOnMount skips client fetch when server data is loaded", () => {
  assert.equal(shouldLoadListOnMount(true), false);
});

test("shouldLoadListOnMount preserves client fetch fallback without initial data", () => {
  assert.equal(shouldLoadListOnMount(false), true);
});
