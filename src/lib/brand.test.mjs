import test from "node:test";
import assert from "node:assert/strict";

import {
  APP_NAME,
  APP_DOMAIN,
  LEGACY_APP_NAMES,
  PRIMARY_STORAGE_KEYS,
  LEGACY_STORAGE_KEYS,
} from "./brand.ts";

test("brand constants point to Yapp as the primary public brand", () => {
  assert.equal(APP_NAME, "Yapp");
  assert.equal(APP_DOMAIN, "yapp.wideget.net");
});

test("legacy brand values remain available for compatibility fallbacks", () => {
  assert.deepEqual(LEGACY_APP_NAMES, ["Qkiki", "qkiki", "QKIKI"]);
  assert.equal(PRIMARY_STORAGE_KEYS.language, "yapp-language");
  assert.equal(LEGACY_STORAGE_KEYS.language[0], "qkiki-language");
});
