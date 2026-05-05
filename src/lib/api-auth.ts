import { NextResponse } from "next/server";
import { isAdminRole } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth";

export class ApiUnauthorizedError extends Error {
  constructor() {
    super("Authentication required.");
  }
}

export class ApiForbiddenError extends Error {
  constructor(message = "Forbidden.") {
    super(message);
  }
}

export async function requireApiUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new ApiUnauthorizedError();
  }
  if (user.status === "SUSPENDED") {
    throw new ApiForbiddenError("Account suspended.");
  }

  return user;
}

export async function requireApiAdmin() {
  const user = await requireApiUser();
  if (!isAdminRole(user.role)) {
    throw new ApiForbiddenError();
  }
  return user;
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiUnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ApiForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Request failed." },
    { status: 500 },
  );
}
