export type AppLanguage = "en" | "ko";
export type GuidanceProviderName = "openai" | "anthropic" | "google" | "xai";

export type ModelGuidance = {
  recommended: boolean;
  recommendedLabel: string;
  trustLabel: string;
  traits: string[];
};

function traitLabels(kind: "fast" | "balanced" | "deep" | "review", language: AppLanguage) {
  if (language === "ko") {
    if (kind === "fast") return "빠름";
    if (kind === "balanced") return "균형";
    if (kind === "deep") return "정교함";
    return "검토용";
  }

  if (kind === "fast") return "Fast";
  if (kind === "balanced") return "Balanced";
  if (kind === "deep") return "Deep";
  return "Review";
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
    normalizedModel.includes("gpt-5.4") ||
    normalizedModel.includes("gpt-5.5")
  ) {
    traits.push(traitLabels("balanced", language));
  }

  if (
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
      language === "ko" ? "추천 시작점" : "Recommended start",
    trustLabel:
      language === "ko"
        ? "선택한 모델 그대로 실행"
        : "Runs exactly with the model you picked",
    traits: Array.from(new Set(traits)).slice(0, 2),
  };
}
