import "server-only";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE,
  TRIAL_COOKIE_CANDIDATES,
  USER_SESSION_COOKIE_CANDIDATES,
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

export function hashSessionToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  if (Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("Password exceeds bcrypt's 72-byte limit.");
  }
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  if (Buffer.byteLength(password, "utf8") > 72) {
    return false;
  }
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
  for (const cookieName of TRIAL_COOKIE_CANDIDATES) {
    cookieStore.delete(cookieName);
  }
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
  const token = USER_SESSION_COOKIE_CANDIDATES
    .map((cookieName) => cookieStore.get(cookieName)?.value)
    .find(Boolean);

  if (token) {
    await prisma.authSession.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
  }

  for (const cookieName of [
    ...USER_SESSION_COOKIE_CANDIDATES,
    ...TRIAL_COOKIE_CANDIDATES,
  ]) {
    cookieStore.delete(cookieName);
  }
}

export function getInitialRoleForEmail(_email: string): UserRole {
  // Public identity proof must never double as an administrator bootstrap.
  // Promote the first administrator only through the offline launch runbook.
  return UserRole.USER;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();

  const token = USER_SESSION_COOKIE_CANDIDATES
    .map((cookieName) => cookieStore.get(cookieName)?.value)
    .find(Boolean);
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

  const isTrial = session.user.email.endsWith(TRIAL_EMAIL_DOMAIN);

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    status: session.user.status,
    isTrial,
  };
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }
  if (user.status === "SUSPENDED") {
    await clearAuthSession();
    redirect("/sign-in");
  }

  return user;
}

export function isAdminRole(role: UserRole) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}
