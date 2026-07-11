import test from "node:test";
import assert from "node:assert/strict";

import {
  readBrowserStorageValue,
  readBrowserStorageValueAny,
  writeBrowserStorageValue,
} from "./browser-storage.ts";

test("readBrowserStorageValueAny prefers the new Yapp key", () => {
  const storage = {
    getItem(key) {
      if (key === "yapp-language") return "ko";
      if (key === "qkiki-language") return "en";
      return null;
    },
  };

  assert.equal(
    readBrowserStorageValueAny(["yapp-language", "qkiki-language"], { storage }),
    "ko",
  );
});

test("readBrowserStorageValueAny falls back to the legacy Qkiki key", () => {
  const storage = {
    getItem(key) {
      if (key === "qkiki-language") return "en";
      return null;
    },
  };

  assert.equal(
    readBrowserStorageValueAny(["yapp-language", "qkiki-language"], { storage }),
    "en",
  );
});

test("writeBrowserStorageValue writes the provided key as-is", () => {
  const writes = [];
  const storage = {
    setItem(key, value) {
      writes.push([key, value]);
    },
  };

  assert.equal(
    writeBrowserStorageValue("yapp-language", "ko", { storage }),
    true,
  );
  assert.deepEqual(writes, [["yapp-language", "ko"]]);
});

test("readBrowserStorageValue still returns null when the key is missing", () => {
  const storage = {
    getItem() {
      return null;
    },
  };

  assert.equal(readBrowserStorageValue("yapp-language", { storage }), null);
});

test("readBrowserStorageValue returns null when storage access throws", () => {
  const storage = {
    getItem() {
      throw new Error("blocked");
    },
  };

  assert.equal(readBrowserStorageValue("yapp-language", { storage }), null);
});

test("readBrowserStorageValueAny skips blocked keys safely", () => {
  const storage = {
    getItem() {
      throw new Error("blocked");
    },
  };

  assert.equal(
    readBrowserStorageValueAny(["yapp-language", "qkiki-language"], { storage }),
    null,
  );
});

test("writeBrowserStorageValue returns false when storage writes throw", () => {
  const storage = {
    setItem() {
      throw new Error("blocked");
    },
  };

  assert.equal(
    writeBrowserStorageValue("yapp-language", "ko", { storage }),
    false,
  );
});
