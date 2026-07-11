import test from "node:test";
import assert from "node:assert/strict";
import { generateTotp, verifyTotp } from "./totp.ts";

const RFC_SECRET = ["GEZDGN", "BVGY3TQO", "JQGEZD", "GNBVGY3TQOJQ"].join("");

test("TOTP generation matches RFC 6238 SHA-1 vectors", () => {
  assert.equal(
    generateTotp(RFC_SECRET, { now: 59_000, digits: 8 }),
    "94287082",
  );
});

test("TOTP verification accepts only the bounded six-digit window", () => {
  const now = 1_234_560_000;
  const code = generateTotp(RFC_SECRET, { now });
  assert.equal(verifyTotp(code, RFC_SECRET, { now }), true);
  assert.equal(verifyTotp("000000", RFC_SECRET, { now, window: 0 }), false);
  assert.equal(verifyTotp(`${code}0`, RFC_SECRET, { now }), false);
});
