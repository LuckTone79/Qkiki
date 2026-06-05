import test from "node:test";
import assert from "node:assert/strict";

import { buildSessionInputCopyNotice } from "./session-input-copy.ts";

test("buildSessionInputCopyNotice returns a copied notice in English", () => {
  const result = buildSessionInputCopyNotice({
    language: "en",
    copied: true,
  });

  assert.equal(result, "Copied the original input.");
});

test("buildSessionInputCopyNotice returns a blocked notice in Korean", () => {
  const result = buildSessionInputCopyNotice({
    language: "ko",
    copied: false,
  });

  assert.equal(
    result,
    "브라우저가 원본 입력 자동 복사를 막았습니다.",
  );
});
