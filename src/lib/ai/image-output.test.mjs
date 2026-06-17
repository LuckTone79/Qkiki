import test from "node:test";
import assert from "node:assert/strict";

import {
  IMAGE_OUTPUT_TEXT_PLACEHOLDER,
  buildImageDataUrl,
  isImageDataUrl,
  textOutputForPrompt,
} from "./image-output.ts";

test("buildImageDataUrl defaults to image/png", () => {
  assert.equal(buildImageDataUrl("QUJD"), "data:image/png;base64,QUJD");
});

test("buildImageDataUrl honors the provided mime type", () => {
  assert.equal(
    buildImageDataUrl("QUJD", "image/jpeg"),
    "data:image/jpeg;base64,QUJD",
  );
});

test("isImageDataUrl detects generated image output", () => {
  assert.equal(isImageDataUrl("data:image/png;base64,QUJD"), true);
  assert.equal(isImageDataUrl("data:image/webp;base64,QUJD"), true);
  assert.equal(isImageDataUrl("  data:image/png;base64,QUJD  "), true);
});

test("isImageDataUrl ignores plain text and non-image data URLs", () => {
  assert.equal(isImageDataUrl("Here is the answer."), false);
  assert.equal(isImageDataUrl("data:text/plain;base64,QUJD"), false);
  assert.equal(isImageDataUrl(null), false);
  assert.equal(isImageDataUrl(undefined), false);
});

test("textOutputForPrompt replaces image output with a placeholder", () => {
  assert.equal(
    textOutputForPrompt("data:image/png;base64,QUJD"),
    IMAGE_OUTPUT_TEXT_PLACEHOLDER,
  );
});

test("textOutputForPrompt passes plain text through unchanged", () => {
  assert.equal(textOutputForPrompt("A normal answer."), "A normal answer.");
  assert.equal(textOutputForPrompt(null), "");
});
