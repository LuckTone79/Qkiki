import "server-only";

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getUserSubscriptionState } from "@/lib/subscription";

export const TRIAL_CONVERSATION_LIMIT = Number(
  process.env.TRIAL_CONVERSATION_LIMIT ?? "5",
);
export const TRIAL_SESSION_HOURS = Number(
  process.env.TRIAL_SESSION_HOURS ?? "24",
);
export const FREE_USER_DAILY_TOKEN_LIMIT = Number(
  process.env.FREE_USER_DAILY_TOKEN_LIMIT ?? "50000",
);

function getPolicySecret() {
  return process.env.APP_SECRET || "dev-only-change-before-production";
}

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [firstIp] = forwardedFor.split(",");
    if (firstIp?.trim()) {
      return firstIp.trim();
    }
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp?.trim()) {
    return realIp.trim();
  }

  return null;
}

export function hashIpAddress(ipAddress: string) {
  return crypto
    .createHmac("sha256", getPolicySecret())
    .update(ipAddress)
    .digest("hex");
}

export function buildTrialLoginRedirect() {
  return "/sign-in?next=%2Fapp%2Fworkbench&reason=trial_login_required";
}

export function buildTrialLimitRedirect() {
  return "/sign-in?next=%2Fapp%2Fworkbench&reason=trial_limit";
}

export function hasActiveSubscription(input: {
  isLifetime: boolean;
  planEndsAt: Date | null;
}) {
  return input.isLifetime || Boolean(input.planEndsAt && input.planEndsAt > new Date());
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function getFreeUserTokenUsageToday(userId: string) {
  const totals = await prisma.aiRequest.aggregate({
    where: {
      userId,
      createdAt: { gte: startOfToday() },
    },
    _sum: {
      inputTokens: true,
      outputTokens: true,
    },
  });

  return (totals._sum.inputTokens ?? 0) + (totals._sum.outputTokens ?? 0);
}

export async function isSubscribedUser(userId: string) {
  const subscription = await getUserSubscriptionState(userId);
  return hasActiveSubscription(subscription);
}
