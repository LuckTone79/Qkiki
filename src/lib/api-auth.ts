import { NextResponse } from "next/server";
import { clearAuthSession, getCurrentUser, isAdminRole } from "@/lib/auth";
import type { CurrentUser } from "@/lib/auth";
import {
  buildTrialLimitRedirect,
  buildTrialLoginRedirect,
  TRIAL_CONVERSATION_LIMIT,
} from "@/lib/access-policy";
import { prisma } from "@/lib/prisma";
import {
  ActiveRunLimitReachedError,
  ActiveSessionRunExistsError,
} from "@/lib/execution-runs";
import {
  UsageInputLimitError,
  UsageLimitReachedError,
} from "@/lib/usage-policy";

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

export async function requireApiGenerationUser() {
  const user = await requireApiUser();
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
  if (error instanceof UsageLimitReachedError) {
    return NextResponse.json(
      {
        error: error.message,
        code: "LIMIT_REACHED",
        usage: error.summary,
      },
      { status: 403 },
    );
  }
  if (error instanceof UsageInputLimitError) {
    return NextResponse.json(
      {
        error: error.message,
        code: "INPUT_TOO_LONG",
        usage: error.summary,
      },
      { status: 400 },
    );
  }
  if (error instanceof ActiveRunLimitReachedError) {
    return NextResponse.json(
      {
        error: error.message,
        code: "ACTIVE_RUN_LIMIT",
      },
      { status: 429 },
    );
  }
  if (error instanceof ActiveSessionRunExistsError) {
    return NextResponse.json(
      {
        error: error.message,
        code: "SESSION_RUN_ACTIVE",
      },
      { status: 409 },
    );
  }

  console.error("[api] unhandled request failure", error);

  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Request failed." },
    { status: 500 },
  );
}
