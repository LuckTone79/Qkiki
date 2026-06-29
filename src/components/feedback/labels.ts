import type { AppLanguage } from "@/components/i18n/LanguageProvider";

export type FeedbackCategoryValue =
  | "BUG"
  | "FEATURE"
  | "IMPROVEMENT"
  | "QUESTION"
  | "OTHER";

export type FeedbackStatusValue =
  | "OPEN"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED";

const categoryLabels: Record<
  FeedbackCategoryValue,
  Record<AppLanguage, string>
> = {
  BUG: { ko: "버그/오류", en: "Bug", ja: "バグ/エラー", es: "Error" },
  FEATURE: {
    ko: "기능 요청",
    en: "Feature request",
    ja: "機能リクエスト",
    es: "Solicitud de función",
  },
  IMPROVEMENT: {
    ko: "개선 제안",
    en: "Improvement",
    ja: "改善提案",
    es: "Mejora",
  },
  QUESTION: { ko: "문의", en: "Question", ja: "問い合わせ", es: "Pregunta" },
  OTHER: { ko: "기타", en: "Other", ja: "その他", es: "Otro" },
};

const statusLabels: Record<FeedbackStatusValue, Record<AppLanguage, string>> = {
  OPEN: { ko: "접수됨", en: "Open", ja: "受付済み", es: "Abierto" },
  IN_PROGRESS: {
    ko: "처리 중",
    en: "In progress",
    ja: "対応中",
    es: "En progreso",
  },
  RESOLVED: { ko: "해결됨", en: "Resolved", ja: "解決済み", es: "Resuelto" },
  CLOSED: { ko: "종료됨", en: "Closed", ja: "クローズ", es: "Cerrado" },
};

const statusBadgeClass: Record<FeedbackStatusValue, string> = {
  OPEN: "border-sky-200 bg-sky-50 text-sky-700",
  IN_PROGRESS: "border-amber-200 bg-amber-50 text-amber-700",
  RESOLVED: "border-teal-200 bg-teal-50 text-teal-700",
  CLOSED: "border-stone-200 bg-stone-100 text-stone-600",
};

export const FEEDBACK_CATEGORY_VALUES: FeedbackCategoryValue[] = [
  "BUG",
  "FEATURE",
  "IMPROVEMENT",
  "QUESTION",
  "OTHER",
];

export const FEEDBACK_STATUS_VALUES: FeedbackStatusValue[] = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
];

export function categoryLabel(
  value: FeedbackCategoryValue,
  language: AppLanguage,
) {
  return categoryLabels[value]?.[language] ?? value;
}

export function statusLabel(value: FeedbackStatusValue, language: AppLanguage) {
  return statusLabels[value]?.[language] ?? value;
}

export function statusBadgeClassName(value: FeedbackStatusValue) {
  return statusBadgeClass[value] ?? statusBadgeClass.OPEN;
}

export function formatFeedbackDate(value: string, language: AppLanguage) {
  const localeMap: Record<AppLanguage, string> = {
    en: "en-US",
    ko: "ko-KR",
    ja: "ja-JP",
    es: "es-ES",
  };

  return new Intl.DateTimeFormat(localeMap[language], {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
