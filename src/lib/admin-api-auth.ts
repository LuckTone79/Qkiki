import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import {
  canManageAdmin,
  canManageCritical,
  getCurrentAdmin,
  type CurrentAdmin,
} from "@/lib/admin-auth";
import { canAdminMutateUser } from "@/lib/admin-authorization";
import {
  getPublicFailureMessage,
  secureLogError,
} from "@/lib/error-safety";

export class AdminApiUnauthorizedError extends Error {
  constructor() {
    super("Admin authentication required.");
  }
}

export class AdminApiForbiddenError extends Error {
  constructor(message = "Admin permission required.") {
    super(message);
  }
}

export async function requireApiAdminViewer() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    throw new AdminApiUnauthorizedError();
  }

  return admin;
}

export async function requireApiAdminManager() {
  const admin = await requireApiAdminViewer();

  if (!canManageAdmin(admin.role)) {
    throw new AdminApiForbiddenError();
  }

  return admin;
}

export async function requireApiAdminCritical() {
  const admin = await requireApiAdminViewer();

  if (!canManageCritical(admin.role)) {
    throw new AdminApiForbiddenError("Super administrator permission required.");
  }

  return admin;
}

export function assertApiAdminCanMutateUser(
  admin: CurrentAdmin,
  target: { id: string; role: UserRole },
) {
  if (!canAdminMutateUser(admin, target)) {
    throw new AdminApiForbiddenError(
      "This account cannot be modified through the admin API.",
    );
  }
}

export function adminApiErrorResponse(error: unknown) {
  if (error instanceof AdminApiUnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  if (error instanceof AdminApiForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  secureLogError("admin_api.unhandled_request_failure", error);

  // Raw error messages stay in server logs only; they can carry internal
  // details (connection strings, paths) that must not reach the client.
  return NextResponse.json(
    { error: getPublicFailureMessage("admin-api") },
    { status: 500 },
  );
}

export function getRequestMeta(request: Request) {
  const userAgent = request.headers.get("user-agent") || null;
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const ipAddress = forwardedFor.split(",")[0]?.trim() || null;

  return {
    userAgent,
    ipAddress,
  };
}
