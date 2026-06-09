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
  { ko: string; en: string }
> = {
  BUG: { ko: "버그/오류", en: "Bug" },
  FEATURE: { ko: "기능 요청", en: "Feature request" },
  IMPROVEMENT: { ko: "개선 제안", en: "Improvement" },
  QUESTION: { ko: "문의", en: "Question" },
  OTHER: { ko: "기타", en: "Other" },
};

const statusLabels: Record<FeedbackStatusValue, { ko: string; en: string }> = {
  OPEN: { ko: "접수됨", en: "Open" },
  IN_PROGRESS: { ko: "처리 중", en: "In progress" },
  RESOLVED: { ko: "해결됨", en: "Resolved" },
  CLOSED: { ko: "종료됨", en: "Closed" },
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
  return new Intl.DateTimeFormat(language === "ko" ? "ko-KR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
