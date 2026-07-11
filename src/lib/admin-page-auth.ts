import "server-only";

import { redirect } from "next/navigation";
import {
  canManageAdmin,
  canManageCritical,
  requireAdminViewer,
} from "@/lib/admin-auth";

export async function requireAdminManagerPage() {
  const admin = await requireAdminViewer();

  if (!canManageAdmin(admin.role)) {
    redirect("/admin");
  }

  return admin;
}

export async function requireAdminCriticalPage() {
  const admin = await requireAdminViewer();

  if (!canManageCritical(admin.role)) {
    redirect("/admin");
  }

  return admin;
}

