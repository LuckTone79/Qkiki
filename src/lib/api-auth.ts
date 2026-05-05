import { NextResponse } from "next/server";
import { clearAuthSession, getCurrentUser, isAdminRole } from "@/lib/auth";
import type { CurrentUser } from "@/lib/auth";
import {
  buildTrialLimitRedirect,
  buildTrialLoginRedirect,
  FREE_USER_DAILY_TOKEN_LIMIT,
  getFreeUserTokenUsageToday,
  isSubscribedUser,
  TRIAL_CONVERSATION_LIMIT,
} from "@/lib/access-policy";
import { prisma } from "@/lib/prisma";

export class ApiUnauthorizedError extends Error {
  redirectUrl?: string;

  constructor(message = "Authentication required.", redirectUrl?: string) {
    super(message);
    this.redirectUrl = redirectUrl;
  }
}

export class ApiForbiddenError extends Error {
  constructor(message = "Forbidden.") {
    super(message);
  }
}

export async function requireApiUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new ApiUnauthorizedError();
  }
  if (user.status === "SUSPENDED") {
    throw new ApiForbiddenError("Account suspended.");
  }

  return user;
}

export async function consumeTrialConversation(user: CurrentUser) {
  const access = await prisma.trialAccess.findUnique({
    where: { trialUserId: user.id },
  });

  if (!access) {
    await clearAuthSession();
    throw new ApiUnauthorizedError(
      "Trial session expired. Sign in to continue.",
      buildTrialLoginRedirect(),
    );
  }

  if (access.conversationCount >= TRIAL_CONVERSATION_LIMIT) {
    await clearAuthSession();
    await prisma.trialAccess.update({
      where: { id: access.id },
      data: {
        limitReachedAt: access.limitReachedAt ?? new Date(),
        lastUsedAt: new Date(),
      },
    });
    throw new ApiUnauthorizedError(
      `Trial limit reached. Sign in after ${TRIAL_CONVERSATION_LIMIT} conversations to continue.`,
      buildTrialLimitRedirect(),
    );
  }

  await prisma.trialAccess.update({
    where: { id: access.id },
    data: {
      conversationCount: { increment: 1 },
      lastUsedAt: new Date(),
      limitReachedAt:
        access.conversationCount + 1 >= TRIAL_CONVERSATION_LIMIT
          ? new Date()
          : null,
    },
  });
}

async function assertFreeUserTokenQuota(user: CurrentUser) {
  if (user.isTrial) {
    return;
  }

  const subscribed = await isSubscribedUser(user.id);
  if (subscribed) {
    return;
  }

  const usedTokens = await getFreeUserTokenUsageToday(user.id);
  if (usedTokens >= FREE_USER_DAILY_TOKEN_LIMIT) {
    throw new ApiForbiddenError(
      `Free account daily token limit reached (${FREE_USER_DAILY_TOKEN_LIMIT.toLocaleString()} tokens).`,
    );
  }
}

export async function requireApiGenerationUser() {
  const user = await requireApiUser();

  if (user.isTrial) {
    return user;
  }

  await assertFreeUserTokenQuota(user);
  return user;
}

export async function requireApiAdmin() {
  const user = await requireApiUser();
  if (!isAdminRole(user.role)) {
    throw new ApiForbiddenError();
  }
  return user;
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiUnauthorizedError) {
    return NextResponse.json(
      { error: error.message, redirectUrl: error.redirectUrl },
      { status: 401 },
    );
  }
  if (error instanceof ApiForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Request failed." },
    { status: 500 },
  );
}
