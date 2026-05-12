import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuthSession, getInitialRoleForEmail, hashPassword } from "@/lib/auth";
import { getAuthRuntimeDiagnostics } from "@/lib/auth-config";
import { grantWelcomeBoostToUser } from "@/lib/usage-policy";
import { signUpSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const diagnostics = getAuthRuntimeDiagnostics();
  if (!diagnostics.databaseConfigured) {
    return NextResponse.json(
      { error: "Server auth is misconfigured: DATABASE_URL (PostgreSQL) is required." },
      { status: 500 },
    );
  }

  const parsed = signUpSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid sign-up data." },
      { status: 400 },
    );
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An account already exists for this email." },
        { status: 409 },
      );
    }

    const role = getInitialRoleForEmail(parsed.data.email);

    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name || null,
        passwordHash: await hashPassword(parsed.data.password),
        role,
      },
    });

    await grantWelcomeBoostToUser(user.id);
    await createAuthSession(user.id);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Sign-up failed due to server configuration. Check database connection." },
      { status: 500 },
    );
  }
}
