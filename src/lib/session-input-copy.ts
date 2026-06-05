type CopyLanguage = "en" | "ko";

export function buildSessionInputCopyNotice(input: {
  language: CopyLanguage;
  copied: boolean;
}) {
  if (input.copied) {
    return input.language === "ko"
      ? "원본 입력을 복사했습니다."
      : "Copied the original input.";
  }

  return input.language === "ko"
    ? "브라우저가 원본 입력 자동 복사를 막았습니다."
    : "The browser blocked automatic copying of the original input.";
}
