import { type AppLanguage, withAdditionalLanguages } from "../i18n.ts";
import type { ActionType } from "@/lib/ai/types";

type ActionDisplayLanguage = AppLanguage;

const ACTION_DISPLAY_LABELS: Record<
  ActionType,
  Record<ActionDisplayLanguage, string>
> = {
  generate: withAdditionalLanguages({ en: "Generate", ko: "생성" }),
  brainstorm: withAdditionalLanguages({ en: "Brainstorm", ko: "브레인스토밍" }),
  critique: withAdditionalLanguages({ en: "Critique", ko: "비판" }),
  fact_check: withAdditionalLanguages({ en: "Fact-check style review", ko: "팩트체크식 검토" }),
  improve: withAdditionalLanguages({ en: "Improve", ko: "개선" }),
  summarize: withAdditionalLanguages({ en: "Summarize", ko: "요약" }),
  simplify: withAdditionalLanguages({ en: "Simplify", ko: "쉽게 정리" }),
  consistency_review: withAdditionalLanguages({ en: "Consistency review", ko: "일관성 검토" }),
  code_review: withAdditionalLanguages({ en: "Code review", ko: "코드 리뷰" }),
  follow_up: withAdditionalLanguages({ en: "Follow-up", ko: "후속 질문" }),
  scenario_develop: withAdditionalLanguages({ en: "Scenario development", ko: "시나리오 발전" }),
  deep_dive: withAdditionalLanguages({ en: "Deep dive", ko: "딥 다이브" }),
};

export function getActionTypeDisplayLabel(
  actionType: ActionType,
  language: ActionDisplayLanguage,
) {
  return ACTION_DISPLAY_LABELS[actionType][language];
}
