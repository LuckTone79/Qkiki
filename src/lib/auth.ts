import "server-only";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE } from "@/lib/auth-constants";

const SESSION_DAYS = 30;

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  status: "ACTIVE" | "SUSPENDED";
};

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
