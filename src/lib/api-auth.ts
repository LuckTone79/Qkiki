import { NextResponse } from "next/server";
import { getCurrentUser, isAdminRole } from "@/lib/auth";
import {
  ActiveRunLimitReachedError,
  ActiveSessionRunExistsError,
} from "@/lib/execution-runs";
import { UsageCreditLimitReachedError } from "@/lib/usage-policy";
import {
  getPublicFailureMessage,
  secureLogError,
} from "@/lib/error-safety";

export class ApiUnauthorizedError extends Error {
  redirectUrl?: string;

  constructor(message = "Authentication required.", redirectUrl?: string) {
    super(message);
    this.redirectUrl = redirectUrl;
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

export async function requireApiGenerationUser() {
  const user = await requireApiUser();
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
    return NextResponse.json(
      { error: error.message, redirectUrl: error.redirectUrl },
      { status: 401 },
    );
  }
  if (error instanceof ApiForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof UsageCreditLimitReachedError) {
    return NextResponse.json(
      {
        error: error.message,
        code: "CREDIT_LIMIT_REACHED",
        usage: error.summary,
      },
      { status: 403 },
    );
  }
  if (error instanceof ActiveRunLimitReachedError) {
    return NextResponse.json(
      {
        error: error.message,
        code: "ACTIVE_RUN_LIMIT",
      },
      { status: 429 },
    );
  }
  if (error instanceof ActiveSessionRunExistsError) {
    return NextResponse.json(
      {
        error: error.message,
        code: "SESSION_RUN_ACTIVE",
      },
      { status: 409 },
    );
  }

  secureLogError("api.unhandled_request_failure", error);

  // Never echo raw error messages to the client: database/driver errors can
  // contain connection details, file paths, or query fragments.
  return NextResponse.json(
    { error: getPublicFailureMessage("api") },
    { status: 500 },
  );
}
