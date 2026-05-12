import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuthSession, verifyPassword } from "@/lib/auth";
import { getAuthRuntimeDiagnostics } from "@/lib/auth-config";
import { signInSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const diagnostics = getAuthRuntimeDiagnostics();
  if (!diagnostics.databaseConfigured) {
    return NextResponse.json(
      { error: "Server auth is misconfigured: DATABASE_URL (PostgreSQL) is required." },
      { status: 500 },
    );
  }

  const parsed = signInSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid sign-in data." },
      { status: 400 },
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });

    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return NextResponse.json(
        { error: "Email or password is incorrect." },
        { status: 401 },
      );
    }
    if (user.status === "SUSPENDED") {
      return NextResponse.json(
        { error: "Account suspended. Contact support." },
        { status: 403 },
      );
    }

    await createAuthSession(user.id);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Sign-in failed due to server configuration. Check database connection." },
      { status: 500 },
    );
  }
}
