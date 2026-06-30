import { type AppLanguage, localize } from "./i18n.ts";
type CopyLanguage = AppLanguage;

export function buildSessionInputCopyNotice(input: {
  language: CopyLanguage;
  copied: boolean;
}) {
  if (input.copied) {
    return localize(input.language, { en: "Copied the original input.", ko: "원본 입력을 복사했습니다.", ja: "\u5143\u306E\u5165\u529B\u3092\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F\u3002", es: "Copi\u00E9 la entrada original." });
  }

  return localize(input.language, { en: "The browser blocked automatic copying of the original input.", ko: "브라우저가 원본 입력 자동 복사를 막았습니다.", ja: "\u30D6\u30E9\u30A6\u30B6\u30FC\u306F\u3001\u5143\u306E\u5165\u529B\u306E\u81EA\u52D5\u30B3\u30D4\u30FC\u3092\u30D6\u30ED\u30C3\u30AF\u3057\u307E\u3057\u305F\u3002", es: "El navegador bloque\u00F3 la copia autom\u00E1tica de la entrada original." });
}
