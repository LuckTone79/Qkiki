import assert from "node:assert/strict";
import test from "node:test";

import {
  SUPPORTED_LANGUAGES,
  isAppLanguage,
  localize,
  normalizeAppLanguage,
  translateUiString,
} from "./i18n.ts";

test("Yapp supports English, Korean, Japanese, and Spanish UI languages", () => {
  assert.deepEqual(SUPPORTED_LANGUAGES, ["en", "ko", "ja", "es"]);
  assert.equal(isAppLanguage("ja"), true);
  assert.equal(isAppLanguage("es"), true);
  assert.equal(isAppLanguage("fr"), false);
});

test("stored application languages normalize safely", () => {
  assert.equal(normalizeAppLanguage("en"), "en");
  assert.equal(normalizeAppLanguage("ko"), "ko");
  assert.equal(normalizeAppLanguage("ja"), "ja");
  assert.equal(normalizeAppLanguage("es"), "es");
  assert.equal(normalizeAppLanguage("fr"), "en");
  assert.equal(normalizeAppLanguage(null), "en");
});

test("localize selects the requested locale without an English fallback", () => {
  const copy = {
    en: "Guide",
    ko: "가이드",
    ja: "ガイド",
    es: "Guía",
  };

  assert.equal(localize("en", copy), "Guide");
  assert.equal(localize("ko", copy), "가이드");
  assert.equal(localize("ja", copy), "ガイド");
  assert.equal(localize("es", copy), "Guía");
});

test("primary navigation and guidebook terms have Japanese and Spanish copy", () => {
  assert.equal(translateUiString("Workbench", "ja"), "ワークベンチ");
  assert.equal(translateUiString("Workbench", "es"), "Espacio de trabajo");
  assert.equal(translateUiString("Projects", "ja"), "プロジェクト");
  assert.equal(translateUiString("Projects", "es"), "Proyectos");
  assert.equal(translateUiString("Guidebook", "ja"), "ガイドブック");
  assert.equal(translateUiString("Guidebook", "es"), "Guía");
});
