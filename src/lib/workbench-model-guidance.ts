export type AppLanguage = "en" | "ko" | "ja" | "es";
export type GuidanceProviderName = "openai" | "anthropic" | "google" | "xai";

export type ModelGuidance = {
  recommended: boolean;
  recommendedLabel: string;
  trustLabel: string;
  traits: string[];
};

function traitLabels(kind: "fast" | "balanced" | "deep" | "review", language: AppLanguage) {
  const labels: Record<
    "fast" | "balanced" | "deep" | "review",
    Record<AppLanguage, string>
  > = {
    fast: { en: "Fast", ko: "빠름", ja: "高速", es: "Rápido" },
    balanced: { en: "Balanced", ko: "균형", ja: "バランス", es: "Equilibrado" },
    deep: { en: "Deep", ko: "정교함", ja: "高精度", es: "Profundo" },
    review: { en: "Review", ko: "검토용", ja: "レビュー向き", es: "Revisión" },
  };

  return labels[kind][language];
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
    recommendedLabel: {
      en: "Recommended start",
      ko: "추천 시작점",
      ja: "おすすめの起点",
      es: "Inicio recomendado",
    }[language],
    trustLabel: {
      en: "Runs exactly with the model you picked",
      ko: "선택한 모델 그대로 실행",
      ja: "選んだモデルそのままで実行",
      es: "Se ejecuta exactamente con el modelo que elegiste",
    }[language],
    traits: Array.from(new Set(traits)).slice(0, 2),
  };
}
