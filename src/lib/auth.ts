import "server-only";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, TRIAL_COOKIE } from "@/lib/auth-constants";

const SESSION_DAYS = 30;

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: "ACTIVE" | "SUSPENDED";
  isTrial?: boolean;
};

function getTrialSecret() {
  return process.env.APP_SECRET || "dev-only-change-before-production";
}

function verifyTrialCookie(token: string): { id: string; exp: number } | null {
  const dotIndex = token.lastIndexOf(".");
  if (dotIndex === -1) return null;
  const payload = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);
  const expectedSig = crypto
    .createHmac("sha256", getTrialSecret())
    .update(payload)
    .digest("base64url");
  if (sig !== expectedSig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!data.id || !data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

function getBootstrapAdminEmails() {
  return (process.env.INITIAL_ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function hashSessionToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createAuthSession(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

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
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function clearAuthSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.authSession.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
  }

  cookieStore.delete(SESSION_COOKIE);
}

export function getInitialRoleForEmail(email: string): UserRole {
  const normalized = email.trim().toLowerCase();
  const bootstrapAdmins = getBootstrapAdminEmails();
  return bootstrapAdmins.includes(normalized) ? UserRole.SUPER_ADMIN : UserRole.USER;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();

  // Check trial cookie first (no DB required)
  const trialToken = cookieStore.get(TRIAL_COOKIE)?.value;
  if (trialToken) {
    const data = verifyTrialCookie(trialToken);
    if (data) {
      return {
        id: data.id,
        email: `${data.id}@trial.local`,
        name: "Trial User",
        role: UserRole.USER,
        status: "ACTIVE",
        isTrial: true,
      };
    }
  }

  const token = cookieStore.get(SESSION_COOKIE)?.value;
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

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    status: session.user.status,
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
