import type { ActionType } from "@/lib/ai/types";

type ActionDisplayLanguage = "en" | "ko" | "ja" | "es";

const ACTION_DISPLAY_LABELS: Record<
  ActionType,
  Record<ActionDisplayLanguage, string>
> = {
  generate: { en: "Generate", ko: "생성", ja: "生成", es: "Generar" },
  brainstorm: {
    en: "Brainstorm",
    ko: "브레인스토밍",
    ja: "ブレインストーミング",
    es: "Lluvia de ideas",
  },
  critique: { en: "Critique", ko: "비판", ja: "批評", es: "Crítica" },
  fact_check: {
    en: "Fact-check style review",
    ko: "팩트체크식 검토",
    ja: "ファクトチェック形式のレビュー",
    es: "Revisión tipo verificación de hechos",
  },
  improve: { en: "Improve", ko: "개선", ja: "改善", es: "Mejorar" },
  summarize: { en: "Summarize", ko: "요약", ja: "要約", es: "Resumir" },
  simplify: { en: "Simplify", ko: "쉽게 정리", ja: "簡潔化", es: "Simplificar" },
  consistency_review: {
    en: "Consistency review",
    ko: "일관성 검토",
    ja: "一貫性レビュー",
    es: "Revisión de consistencia",
  },
  code_review: {
    en: "Code review",
    ko: "코드 리뷰",
    ja: "コードレビュー",
    es: "Revisión de código",
  },
  follow_up: {
    en: "Follow-up",
    ko: "후속 질문",
    ja: "追加質問",
    es: "Seguimiento",
  },
};

export function getActionTypeDisplayLabel(
  actionType: ActionType,
  language: ActionDisplayLanguage,
) {
  return ACTION_DISPLAY_LABELS[actionType][language];
}
