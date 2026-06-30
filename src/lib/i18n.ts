import { UI_TRANSLATIONS } from "./i18n-translations.ts";

export const SUPPORTED_LANGUAGES = ["en", "ko", "ja", "es"] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type LocalizedCopy<T = string> = Record<AppLanguage, T>;

export const APP_LANGUAGE_LABELS: LocalizedCopy = {
  en: "English",
  ko: "한국어",
  ja: "日本語",
  es: "Español",
};

export function isAppLanguage(value: unknown): value is AppLanguage {
  return (
    typeof value === "string" &&
    (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
  );
}

export function normalizeAppLanguage(value: unknown): AppLanguage {
  return isAppLanguage(value) ? value : "en";
}

export function localize<T>(
  language: AppLanguage,
  copy: LocalizedCopy<T>,
): T {
  return copy[language];
}

const TRANSLATIONS = UI_TRANSLATIONS as Record<
  string,
  { ja: string; es: string }
>;

export function translateUiString(
  value: string,
  language: "ja" | "es",
): string {
  return TRANSLATIONS[value]?.[language] ?? value;
}

export function translateLocalizedTree<T>(
  value: T,
  language: "ja" | "es",
  parentKey = "",
): T {
  if (typeof value === "string") {
    if (["icon", "num", "href", "key"].includes(parentKey)) {
      return value;
    }
    return translateUiString(value, language) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => translateLocalizedTree(item, language, parentKey)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        translateLocalizedTree(item, language, key),
      ]),
    ) as T;
  }
  return value;
}

export function withAdditionalLanguages<English, Korean>(base: {
  en: English;
  ko: Korean;
}) {
  return {
    ...base,
    ja: translateLocalizedTree(base.en, "ja"),
    es: translateLocalizedTree(base.en, "es"),
  };
}
