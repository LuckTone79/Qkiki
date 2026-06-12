export type PlanLimitPolicy = {
  dailyLimit: number;
  monthlyCreditLimit: number;
  dailyCreditLimit: number;
  inputCharLimit: number;
  resultSaveLimit: number;
  shareDailyLimit: number;
  advancedReasoningDailyLimit: number;
};

export type PaidPlanKey = "starter" | "pro" | "team";

export const QKIKI_PLAN_LIMITS = {
  free: {
    dailyLimit: 10,
    monthlyCreditLimit: 50,
    dailyCreditLimit: 25,
    inputCharLimit: 3000,
    resultSaveLimit: 10,
    shareDailyLimit: 3,
    advancedReasoningDailyLimit: 1,
  },
  boost: {
    dailyLimit: 30,
    monthlyCreditLimit: 250,
    dailyCreditLimit: 80,
    inputCharLimit: 5000,
    resultSaveLimit: 50,
    shareDailyLimit: 10,
    advancedReasoningDailyLimit: 3,
  },
  starter: {
    dailyLimit: 40,
    monthlyCreditLimit: 700,
    dailyCreditLimit: 120,
    inputCharLimit: 12000,
    resultSaveLimit: 120,
    shareDailyLimit: 15,
    advancedReasoningDailyLimit: 4,
  },
  pro: {
    dailyLimit: 120,
    monthlyCreditLimit: 2400,
    dailyCreditLimit: 400,
    inputCharLimit: 60000,
    resultSaveLimit: 600,
    shareDailyLimit: 60,
    advancedReasoningDailyLimit: 25,
  },
  team: {
    dailyLimit: 250,
    monthlyCreditLimit: 7500,
    dailyCreditLimit: 1300,
    inputCharLimit: 100000,
    resultSaveLimit: 2500,
    shareDailyLimit: 180,
    advancedReasoningDailyLimit: 100,
  },
} satisfies Record<string, PlanLimitPolicy>;

export const QKIKI_PRICING_PLANS = [
  {
    key: "starter",
    title: "Starter",
    monthlyPriceUsd: 11.3,
    annualPriceUsd: 113,
    limits: QKIKI_PLAN_LIMITS.starter,
    positioning:
      "Entry plan priced below the $20 single-chatbot subscriptions, with enough credits for light multi-model comparison.",
    positioningKo:
      "$20 단일 챗봇 구독보다 낮은 입문 플랜입니다. 가벼운 병렬 비교와 짧은 검토 체인을 검증하기 위한 용도입니다.",
  },
  {
    key: "pro",
    title: "Pro",
    monthlyPriceUsd: 29,
    annualPriceUsd: 290,
    limits: QKIKI_PLAN_LIMITS.pro,
    positioning:
      "Main individual plan for users who repeatedly compare models and run structured review chains.",
    positioningKo:
      "반복적으로 모델을 비교하고 순차 검토 체인을 돌리는 개인 사용자를 위한 주력 플랜입니다.",
  },
  {
    key: "team",
    title: "Team",
    monthlyPriceUsd: 89,
    annualPriceUsd: 890,
    limits: QKIKI_PLAN_LIMITS.team,
    positioning:
      "Shared plan for small teams that need longer inputs, more saved results, and heavier monthly usage.",
    positioningKo:
      "긴 입력, 더 많은 저장 결과, 공유 사용량이 필요한 소규모 팀용 플랜입니다.",
  },
] as const;

export const QKIKI_CREDIT_PACK = {
  key: "credit",
  title: "Credit Pack",
  priceUsd: 39,
  credits: 2500,
  expiresInMonths: 12,
  positioning:
    "Optional top-up for peak projects. It is intentionally priced above subscription credits so monthly plans remain the best value.",
  positioningKo:
    "피크 프로젝트용 선택 충전권입니다. 월 구독이 기본 혜택으로 남도록 구독 포함 크레딧보다 높게 책정합니다.",
} as const;
