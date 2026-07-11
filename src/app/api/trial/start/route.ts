import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildTrialLoginRedirect,
  getRequestIp,
  hashIpAddress,
  TRIAL_SESSION_HOURS,
} from "@/lib/access-policy";
import { createAuthSession, getCurrentUser, hashPassword, hashSessionToken } from "@/lib/auth";
import { TRIAL_COOKIE } from "@/lib/auth-constants";
import { buildCanonicalRedirectUrl } from "@/lib/canonical-host";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";

const TRIAL_SESSION_DURATION_MS = TRIAL_SESSION_HOURS * 60 * 60 * 1000;
const TRIAL_PROOF_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

async function issueTrialSession(userId: string, browserToken: string) {
  await createAuthSession(userId, {
    durationMs: TRIAL_SESSION_DURATION_MS,
    persistCookie: false,
  });
  const cookieStore = await cookies();
  cookieStore.set(TRIAL_COOKIE, browserToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TRIAL_PROOF_MAX_AGE_SECONDS,
  });
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit({
    request,
    scope: "trial:start",
    limit: 6,
    windowMs: 10 * 60_000,
  });
  if (limited) {
    return limited;
  }

  const canonicalRedirect = buildCanonicalRedirectUrl(request.url);
  const currentUser = await getCurrentUser();
  if (canonicalRedirect) {
    if (currentUser) {
      return NextResponse.json({
        success: true,
        redirectUrl: currentUser.isTrial ? "/app/workbench?trial=true" : "/app/workbench",
      });
    }
    canonicalRedirect.pathname = "/";
    canonicalRedirect.search = "";
    return NextResponse.json({ success: true, redirectUrl: canonicalRedirect.toString() });
  }

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
    include: { trialUser: true },
  });
  const cookieStore = await cookies();
  const browserToken = cookieStore.get(TRIAL_COOKIE)?.value;

  if (existing) {
    const presentedHash = browserToken ? hashSessionToken(browserToken) : "";
    const ownsTrial = Boolean(
      existing.browserTokenHash &&
        presentedHash &&
        crypto.timingSafeEqual(
          Buffer.from(presentedHash, "hex"),
          Buffer.from(existing.browserTokenHash, "hex"),
        ),
    );
    if (!ownsTrial || existing.trialUser.status !== "ACTIVE") {
      return NextResponse.json(
        {
          error: "A trial already exists for this network. Sign in to continue.",
          redirectUrl: buildTrialLoginRedirect(),
        },
        { status: 409, headers: { "Cache-Control": "private, no-store" } },
      );
    }

    await prisma.trialAccess.update({
      where: { id: existing.id },
      data: { lastUsedAt: new Date() },
    });
    await issueTrialSession(existing.trialUserId, browserToken!);
    return NextResponse.json({ success: true, redirectUrl: "/app/workbench?trial=true" });
  }

  const newBrowserToken = crypto.randomBytes(32).toString("base64url");
  const passwordHash = await hashPassword(crypto.randomBytes(32).toString("base64url"));
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
        browserTokenHash: hashSessionToken(newBrowserToken),
        trialUserId: user.id,
        lastUsedAt: new Date(),
      },
    });
    return user;
  });

  await issueTrialSession(trialUser.id, newBrowserToken);
  return NextResponse.json({ success: true, redirectUrl: "/app/workbench?trial=true" });
}
