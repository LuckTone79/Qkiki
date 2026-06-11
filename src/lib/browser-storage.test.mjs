import test from "node:test";
import assert from "node:assert/strict";

import {
  readBrowserStorageValue,
  writeBrowserStorageValue,
} from "./browser-storage.ts";

test("readBrowserStorageValue returns the stored string when storage works", () => {
  const storage = {
    getItem(key) {
      return key === "language" ? "ko" : null;
    },
  };

  assert.equal(
    readBrowserStorageValue("language", { storage }),
    "ko",
  );
});

test("readBrowserStorageValue swallows SecurityError from Edge-style blocked storage", () => {
  const storage = {
    getItem() {
      throw new DOMException(
        "Access is denied for this document.",
        "SecurityError",
      );
    },
  };

  assert.equal(
    readBrowserStorageValue("language", { storage }),
    null,
  );
});

test("writeBrowserStorageValue reports false instead of throwing when storage is blocked", () => {
  const storage = {
    setItem() {
      throw new DOMException(
        "Access is denied for this document.",
        "SecurityError",
      );
    },
  };

  assert.equal(
    writeBrowserStorageValue("layout", "double", { storage }),
    false,
  );
});
