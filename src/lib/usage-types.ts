export type UsageStatus = {
  planType: "FREE" | "STARTER" | "PRO" | "TEAM";
  billingType: "NONE" | "MONTHLY" | "YEARLY" | "CREDIT";
  planLabel: "anon" | "free" | "boost" | "starter" | "pro" | "team";
  isAnonymous: boolean;
  isBoostActive: boolean;
  boostEndsAt: string | null;
  boostDaysRemaining: number;
  monthlyCreditLimit: number;
  monthlyCreditsUsed: number;
  monthlyCreditsRemaining: number;
  dailyCreditLimit: number;
  dailyCreditsUsed: number;
  dailyCreditsRemaining: number;
  paidCredits: number;
  bonusCredits: number;
  couponCreditBalance: number;
  couponCreditEndsAt: string | null;
  couponCreditActive: boolean;
  // Period-based "unlimited credits" coupon grant.
  isUnlimitedCredits: boolean;
  unlimitedCreditsEndsAt: string | null;
  walletCreditsAvailable: number;
  planCreditsAvailable: number;
  totalCreditsAvailable: number;
  totalDailyCreditsAvailable: number;
  isCreditLimitReached: boolean;
  inputCharLimit: number;
  warningThresholdReached: boolean;
  resetAt: string;
};

export type UsageErrorPayload = {
  error?: string;
  code?: "INPUT_TOO_LONG" | "CREDIT_LIMIT_REACHED";
  redirectUrl?: string;
  usage?: UsageStatus;
};
