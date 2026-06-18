import test from "node:test";
import assert from "node:assert/strict";

import { normalizeCouponNote } from "./coupon-note.ts";

test("normalizeCouponNote trims surrounding whitespace", () => {
  assert.equal(normalizeCouponNote("  gifted to alice  "), "gifted to alice");
});

test("normalizeCouponNote turns blank text into null", () => {
  assert.equal(normalizeCouponNote("   "), null);
});

test("normalizeCouponNote preserves meaningful multiline memos", () => {
  assert.equal(
    normalizeCouponNote("given to alice\nvia support follow-up"),
    "given to alice\nvia support follow-up",
  );
});
