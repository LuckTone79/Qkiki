import test from "node:test";
import assert from "node:assert/strict";
import {
  finalizeRepeatCountDraft,
  sanitizeRepeatCountDraftInput,
} from "./repeat-count-input.ts";

test("sanitizeRepeatCountDraftInput allows an empty draft while editing", () => {
  assert.equal(sanitizeRepeatCountDraftInput(""), "");
});

test("sanitizeRepeatCountDraftInput keeps digit-only drafts", () => {
  assert.equal(sanitizeRepeatCountDraftInput("12"), "12");
});

test("sanitizeRepeatCountDraftInput rejects non-digit input", () => {
  assert.equal(sanitizeRepeatCountDraftInput("1a"), null);
  assert.equal(sanitizeRepeatCountDraftInput("-"), null);
});

test("finalizeRepeatCountDraft falls back when the draft is empty", () => {
  assert.equal(finalizeRepeatCountDraft("", 3, 50), 3);
});

test("finalizeRepeatCountDraft clamps committed values into the allowed range", () => {
  assert.equal(finalizeRepeatCountDraft("0", 3, 50), 1);
  assert.equal(finalizeRepeatCountDraft("999", 3, 50), 50);
  assert.equal(finalizeRepeatCountDraft("7", 3, 50), 7);
});
