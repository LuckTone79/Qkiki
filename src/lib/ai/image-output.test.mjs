import test from "node:test";
import assert from "node:assert/strict";

import {
  isImageDataUrl,
  imageOutputPlaceholder,
  stripImageDataUrlForText,
} from "./image-output.ts";

test("isImageDataUrl recognizes base64 image data URLs", () => {
  assert.equal(isImageDataUrl("data:image/png;base64,iVBORw0KGgo="), true);
  assert.equal(isImageDataUrl("data:image/jpeg;base64,/9j/4AAQ"), true);
  assert.equal(isImageDataUrl("  data:image/webp;base64,UklGR  "), true);
});

test("isImageDataUrl rejects plain text and non-image data URLs", () => {
  assert.equal(isImageDataUrl("Hello world"), false);
  assert.equal(isImageDataUrl("data:text/plain;base64,aGk="), false);
  assert.equal(isImageDataUrl(null), false);
  assert.equal(isImageDataUrl(undefined), false);
  assert.equal(isImageDataUrl(""), false);
});

test("stripImageDataUrlForText replaces image bytes but keeps plain text", () => {
  const stripped = stripImageDataUrlForText("data:image/png;base64,iVBORw0KGgo=");
  assert.match(stripped, /generated image/i);
  assert.doesNotMatch(stripped, /base64/);

  assert.equal(stripImageDataUrlForText("normal answer"), "normal answer");
  assert.equal(stripImageDataUrlForText(null), "");
});

test("imageOutputPlaceholder is localized", () => {
  assert.equal(imageOutputPlaceholder("ko"), "[생성된 이미지]");
  assert.equal(imageOutputPlaceholder("en"), "[Generated image]");
});
