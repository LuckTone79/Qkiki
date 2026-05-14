import type { ActionType } from "@/lib/ai/types";

type ActionDisplayLanguage = "en" | "ko";

const ACTION_DISPLAY_LABELS: Record<
  ActionType,
  Record<ActionDisplayLanguage, string>
> = {
  generate: { en: "Generate", ko: "생성" },
  critique: { en: "Critique", ko: "비판" },
  fact_check: { en: "Fact-check style review", ko: "팩트체크식 검토" },
  improve: { en: "Improve", ko: "개선" },
  summarize: { en: "Summarize", ko: "요약" },
  simplify: { en: "Simplify", ko: "쉽게 정리" },
  consistency_review: { en: "Consistency review", ko: "일관성 검토" },
  follow_up: { en: "Follow-up", ko: "후속 질문" },
};

export function getActionTypeDisplayLabel(
  actionType: ActionType,
  language: ActionDisplayLanguage,
) {
  return ACTION_DISPLAY_LABELS[actionType][language];
}
