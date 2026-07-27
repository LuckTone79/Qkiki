type CopyLanguage = "en" | "ko" | "ja" | "es";

export function buildSessionInputCopyNotice(input: {
  language: CopyLanguage;
  copied: boolean;
}) {
  if (input.copied) {
    return {
      en: "Copied the original input.",
      ko: "원본 입력을 복사했습니다.",
      ja: "元の入力をコピーしました。",
      es: "Se copió la entrada original.",
    }[input.language];
  }

  return {
    en: "The browser blocked automatic copying of the original input.",
    ko: "브라우저가 원본 입력 자동 복사를 막았습니다.",
    ja: "ブラウザーが元の入力の自動コピーをブロックしました。",
    es: "El navegador bloqueó la copia automática de la entrada original.",
  }[input.language];
}
