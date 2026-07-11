import "server-only";

import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export type CurrentAdmin = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
};

export function canViewAdmin(role: UserRole) {
  return role === "SUPPORT_VIEWER" || role === "ADMIN" || role === "SUPER_ADMIN";
}

export function canManageAdmin(role: UserRole) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function canManageCritical(role: UserRole) {
  return role === "SUPER_ADMIN";
}

/**
 * Admin sign-in shares the same Supabase Auth session as the regular app —
 * there is no separate admin session/cookie anymore. Access is gated purely
 * by `User.role`, checked fresh on every call (no caching of the admin
 * grant itself, though `getCurrentUser()` is per-request cached).
 */
export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const user = await getCurrentUser();

  if (!user || user.isTrial) {
    return null;
  }
  if (user.status === "SUSPENDED" || !canViewAdmin(user.role)) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
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
