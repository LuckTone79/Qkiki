import "server-only";

import crypto from "crypto";
import { UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE } from "@/lib/auth-constants";
import { prisma } from "@/lib/prisma";

const ADMIN_SESSION_DAYS = 7;

export type CurrentAdmin = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
};

function hashAdminToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function canViewAdmin(role: UserRole) {
  return role === "SUPPORT_VIEWER" || role === "ADMIN" || role === "SUPER_ADMIN";
}

export function canManageAdmin(role: UserRole) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function canManageCritical(role: UserRole) {
  return role === "SUPER_ADMIN";
}

export async function createAdminSession(userId: string, mfaVerifiedAt: Date | null) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashAdminToken(token);
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.adminSession.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      mfaVerifiedAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (token) {
    await prisma.adminSession.deleteMany({
      where: { tokenHash: hashAdminToken(token) },
    });
  }

  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashAdminToken(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt.getTime() < Date.now()) {
    return null;
  }

  if (!process.env.ADMIN_MFA_CODE?.trim() || !session.mfaVerifiedAt) {
    return null;
  }

  if (session.user.status === "SUSPENDED" || !canViewAdmin(session.user.role)) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  };
}

export async function requireAdminViewer() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/admin/sign-in");
  }

  return admin;
}

export async function requireAdminManager() {
  const admin = await requireAdminViewer();

  if (!canManageAdmin(admin.role)) {
    redirect("/admin");
  }

  return admin;
}
