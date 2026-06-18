export type PlanLimitPolicy = {
  // Credit-based limits only. The legacy per-request "count" limits
  // (daily run count, daily share/save/advanced-reasoning counts) were removed
  // when the system was unified onto credits.
  monthlyCreditLimit: number;
  dailyCreditLimit: number;
};

export type PaidPlanKey = "starter" | "pro" | "team";

export const QKIKI_PLAN_LIMITS = {
  // Non-logged-in (anonymous) visitors. Metered purely by daily credits.
  anon: {
    monthlyCreditLimit: 900,
    dailyCreditLimit: 30,
  },
  free: {
    monthlyCreditLimit: 350,
    dailyCreditLimit: 70,
  },
  // Welcome boost granted to brand-new signed-in users for a short window.
  boost: {
    monthlyCreditLimit: 900,
    dailyCreditLimit: 150,
  },
  starter: {
    monthlyCreditLimit: 800,
    dailyCreditLimit: 150,
  },
  pro: {
    monthlyCreditLimit: 2200,
    dailyCreditLimit: 450,
  },
  team: {
    monthlyCreditLimit: 7000,
    dailyCreditLimit: 1400,
  },
} satisfies Record<string, PlanLimitPolicy>;

export const QKIKI_PRICING_PLANS = [
  {
    key: "starter",
    title: "Starter",
    monthlyPriceUsd: 7.3,
    annualPriceUsd: 73,
    limits: QKIKI_PLAN_LIMITS.starter,
    positioning:
      "Entry plan priced well below the $20 single-chatbot subscriptions, with a monthly credit bucket for light multi-model comparison.",
    positioningKo:
      "$20 단일 챗봇 구독보다 크게 낮은 입문 플랜입니다. 가벼운 병렬 비교와 짧은 검토 체인을 위한 월 크레딧을 제공합니다.",
  },
  {
    key: "pro",
    title: "Pro",
    monthlyPriceUsd: 19,
    annualPriceUsd: 190,
    limits: QKIKI_PLAN_LIMITS.pro,
    positioning:
      "Main individual plan for users who repeatedly compare models and run structured review chains.",
    positioningKo:
      "반복적으로 모델을 비교하고 순차 검토 체인을 돌리는 개인 사용자를 위한 주력 플랜입니다.",
  },
  {
    key: "team",
    title: "Team",
    monthlyPriceUsd: 59,
    annualPriceUsd: 590,
    limits: QKIKI_PLAN_LIMITS.team,
    positioning:
      "Shared plan for small teams that need longer inputs and heavier monthly credit usage.",
    positioningKo:
      "긴 입력과 더 많은 월 크레딧이 필요한 소규모 팀용 플랜입니다.",
  },
] as const;

export const QKIKI_CREDIT_PACK = {
  key: "credit",
  title: "Credit Pack",
  priceUsd: 25,
  credits: 1500,
  expiresInMonths: 12,
  positioning:
    "Optional top-up for peak projects. It is intentionally priced above subscription credits so monthly plans remain the best value.",
  positioningKo:
    "피크 프로젝트용 선택 충전권입니다. 월 구독이 기본 혜택으로 남도록 구독 포함 크레딧보다 높게 책정합니다.",
} as const;
