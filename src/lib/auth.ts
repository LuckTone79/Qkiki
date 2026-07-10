import "server-only";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureLegacyUserLinked } from "@/lib/supabase/link-legacy-user";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_CANDIDATES,
  TRIAL_COOKIE_CANDIDATES,
  deleteCookies,
  readCookieValue,
} from "@/lib/auth-constants";

const SESSION_DAYS = 30;
const TRIAL_EMAIL_DOMAIN = "@trial.local";

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: "ACTIVE" | "SUSPENDED";
  isTrial?: boolean;
};

// --- Trial (anonymous) sessions -----------------------------------------
//
// Trial visitors (src/app/api/trial/start) are never real, emailed accounts
// — they can't sign up through Supabase Auth. They keep using this legacy
// DB-backed session/cookie mechanism unchanged; real users no longer do.

export function hashSessionToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createAuthSession(
  userId: string,
  options?: { durationMs?: number; persistCookie?: boolean },
) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const persistCookie = options?.persistCookie ?? true;
  const durationMs =
    options?.durationMs ?? SESSION_DAYS * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + durationMs);

  await prisma.authSession.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { lastActiveAt: new Date() },
  });

  const cookieStore = await cookies();
  deleteCookies(cookieStore, TRIAL_COOKIE_CANDIDATES);
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(persistCookie ? { expires: expiresAt } : {}),
  });
}

export async function clearAuthSession() {
  const cookieStore = await cookies();
  const token = readCookieValue(cookieStore, SESSION_COOKIE_CANDIDATES);

  if (token) {
    await prisma.authSession.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
  }

  deleteCookies(cookieStore, SESSION_COOKIE_CANDIDATES);
  deleteCookies(cookieStore, TRIAL_COOKIE_CANDIDATES);
}

async function getTrialUserUncached(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = readCookieValue(cookieStore, SESSION_COOKIE_CANDIDATES);
  if (!token) {
    return null;
  }

  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt.getTime() < Date.now()) {
    return null;
  }
  if (!session.user.email.endsWith(TRIAL_EMAIL_DOMAIN)) {
    // Legacy real-user session left over from before the Supabase Auth
    // migration. Real users authenticate through Supabase now; don't trust
    // this cookie for them.
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    status: session.user.status,
    isTrial: true,
  };
}

async function getCurrentUserUncached(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  if (supabaseUser) {
    const legacyUser = await ensureLegacyUserLinked(supabaseUser);
    return {
      id: legacyUser.id,
      email: legacyUser.email,
      name: legacyUser.name,
      role: legacyUser.role,
      status: legacyUser.status,
      isTrial: false,
    };
  }

  return getTrialUserUncached();
}

export const getCurrentUser = cache(getCurrentUserUncached);

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }
  if (user.status === "SUSPENDED") {
    if (user.isTrial) {
      await clearAuthSession();
    } else {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    }
    redirect("/sign-in");
  }

  return user;
}

export function isAdminRole(role: UserRole) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}
