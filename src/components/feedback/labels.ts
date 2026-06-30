import { withAdditionalLanguages } from "@/lib/i18n";
import { localize } from "@/lib/i18n";
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
  BUG: withAdditionalLanguages({ ko: "버그/오류", en: "Bug" }),
  FEATURE: withAdditionalLanguages({ ko: "기능 요청", en: "Feature request" }),
  IMPROVEMENT: withAdditionalLanguages({ ko: "개선 제안", en: "Improvement" }),
  QUESTION: withAdditionalLanguages({ ko: "문의", en: "Question" }),
  OTHER: withAdditionalLanguages({ ko: "기타", en: "Other" }),
};

const statusLabels: Record<FeedbackStatusValue, Record<AppLanguage, string>> = {
  OPEN: withAdditionalLanguages({ ko: "접수됨", en: "Open" }),
  IN_PROGRESS: withAdditionalLanguages({ ko: "처리 중", en: "In progress" }),
  RESOLVED: withAdditionalLanguages({ ko: "해결됨", en: "Resolved" }),
  CLOSED: withAdditionalLanguages({ ko: "종료됨", en: "Closed" }),
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
  return new Intl.DateTimeFormat(localize(language, { en: "en-US", ko: "ko-KR", ja: "en-US", es: "en-US" }), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
