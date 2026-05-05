import crypto from "crypto";
import { NextResponse } from "next/server";
import {
  buildTrialLoginRedirect,
  getRequestIp,
  hashIpAddress,
  TRIAL_SESSION_HOURS,
} from "@/lib/access-policy";
import { createAuthSession, getCurrentUser, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const TRIAL_SESSION_DURATION_MS = TRIAL_SESSION_HOURS * 60 * 60 * 1000;

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (currentUser) {
    return NextResponse.json({
      success: true,
      redirectUrl: currentUser.isTrial ? "/app/workbench?trial=true" : "/app/workbench",
    });
  }

  const ipAddress = getRequestIp(request);
  if (!ipAddress) {
    return NextResponse.json(
      { error: "Unable to verify trial access. Sign in to continue.", redirectUrl: buildTrialLoginRedirect() },
      { status: 401 },
    );
  }

  const ipHash = hashIpAddress(ipAddress);
  const existing = await prisma.trialAccess.findUnique({
    where: { ipHash },
  });

  if (existing) {
    return NextResponse.json(
      {
        error: "This device has already used the trial. Sign in to continue.",
        redirectUrl: buildTrialLoginRedirect(),
      },
      { status: 401 },
    );
  }

  const passwordHash = await hashPassword(crypto.randomUUID());
  const trialUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: `trial-${crypto.randomBytes(8).toString("hex")}@trial.local`,
        name: "Trial User",
        passwordHash,
      },
    });

    await tx.trialAccess.create({
      data: {
        ipHash,
        trialUserId: user.id,
      },
    });

    return user;
  });

  await createAuthSession(trialUser.id, {
    durationMs: TRIAL_SESSION_DURATION_MS,
    persistCookie: false,
  });

  return NextResponse.json({
    success: true,
    redirectUrl: "/app/workbench?trial=true",
  });
}
