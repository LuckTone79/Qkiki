export type UsageStatus = {
  planType: "FREE" | "STARTER" | "PRO" | "TEAM";
  billingType: "NONE" | "MONTHLY" | "YEARLY" | "CREDIT";
  planLabel: "free" | "boost" | "starter" | "pro" | "team";
  isBoostActive: boolean;
  boostEndsAt: string | null;
  boostDaysRemaining: number;
  dailyLimit: number;
  dailyUsed: number;
  remaining: number;
  inputCharLimit: number;
  resultSaveLimit: number;
  shareDailyLimit: number;
  advancedReasoningDailyLimit: number;
  warningThresholdReached: boolean;
  isLimitReached: boolean;
  resetAt: string;
};

export type UsageErrorPayload = {
  error?: string;
  code?: "LIMIT_REACHED" | "INPUT_TOO_LONG";
  redirectUrl?: string;
  usage?: UsageStatus;
};
