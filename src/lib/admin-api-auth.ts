import { NextResponse } from "next/server";
import { canManageAdmin, getCurrentAdmin } from "@/lib/admin-auth";

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

export function adminApiErrorResponse(error: unknown) {
  if (error instanceof AdminApiUnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  if (error instanceof AdminApiForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Admin request failed." },
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
