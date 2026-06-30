import type { AppLanguage } from "./i18n.ts";
import { localize } from "./i18n.ts";
export type { AppLanguage } from "./i18n.ts";
export type GuidanceProviderName = "openai" | "anthropic" | "google" | "xai";

export type ModelGuidance = {
  recommended: boolean;
  recommendedLabel: string;
  trustLabel: string;
  traits: string[];
};

function traitLabels(kind: "fast" | "balanced" | "deep" | "review", language: AppLanguage) {
  const labels = {
    fast: { en: "Fast", ko: "빠름", ja: "高速", es: "Rápido" },
    balanced: { en: "Balanced", ko: "균형", ja: "バランス", es: "Equilibrado" },
    deep: { en: "Deep", ko: "정교함", ja: "詳細", es: "Profundo" },
    review: { en: "Review", ko: "검토용", ja: "レビュー", es: "Revisión" },
  } as const;
  return localize(language, labels[kind]);
}

export function getModelGuidance(
  provider: GuidanceProviderName,
  model: string,
  defaultModel: string,
  language: AppLanguage,
): ModelGuidance {
  const normalizedProvider = provider.trim().toLowerCase();
  const normalizedModel = `${normalizedProvider}:${model.trim().toLowerCase()}`;
  const normalizedDefault = `${normalizedProvider}:${defaultModel.trim().toLowerCase()}`;
  const traits: string[] = [];

  if (
    normalizedModel.includes("mini") ||
    normalizedModel.includes("flash") ||
    normalizedModel.includes("haiku")
  ) {
    traits.push(traitLabels("fast", language));
  }

  if (
    normalizedModel.includes("sonnet") ||
    normalizedModel.includes("gpt-5.4")
  ) {
    traits.push(traitLabels("balanced", language));
  }

  if (
    normalizedModel.includes("gpt-5.5") ||
    normalizedModel.includes("opus") ||
    normalizedModel.includes("pro") ||
    normalizedModel.includes("ultra")
  ) {
    traits.push(traitLabels("deep", language));
  }

  if (
    normalizedModel.includes("opus") ||
    normalizedModel.includes("sonnet") ||
    normalizedModel.includes("grok")
  ) {
    traits.push(traitLabels("review", language));
  }

  const recommended =
    normalizedModel === normalizedDefault;

  return {
    recommended,
    recommendedLabel:
      localize(language, { en: "Recommended start", ko: "추천 시작점", ja: "\u63A8\u5968\u30B9\u30BF\u30FC\u30C8", es: "Inicio recomendado" }),
    trustLabel:
      localize(language, { en: "Runs exactly with the model you picked", ko: "선택한 모델 그대로 실행", ja: "\u9078\u629E\u3057\u305F\u30E2\u30C7\u30EB\u3067\u6B63\u78BA\u306B\u5B9F\u884C\u3055\u308C\u307E\u3059", es: "Funciona exactamente con el modelo que elegiste." }),
    traits: Array.from(new Set(traits)).slice(0, 2),
  };
}
