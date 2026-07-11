import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuthSession, getInitialRoleForEmail, hashPassword } from "@/lib/auth";
import { getAuthRuntimeDiagnostics } from "@/lib/auth-config";
import { buildCanonicalRedirectUrl } from "@/lib/canonical-host";
import { grantWelcomeBoostToUser } from "@/lib/usage-policy";
import { enforceRateLimit } from "@/lib/rate-limit";
import { signUpSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const limited = await enforceRateLimit({
    request,
    scope: "auth:sign-up",
    limit: 5,
    windowMs: 10 * 60_000,
  });
  if (limited) {
    return limited;
  }

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        error:
          "Password sign-up is disabled. Continue with a verified identity provider.",
      },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const diagnostics = getAuthRuntimeDiagnostics();
  if (!diagnostics.databaseConfigured) {
    return NextResponse.json(
      { error: "Authentication is temporarily unavailable." },
      { status: 500 },
    );
  }

  const canonicalRedirect = buildCanonicalRedirectUrl(request.url);
  if (canonicalRedirect) {
    canonicalRedirect.pathname = "/sign-up";
    canonicalRedirect.search = "";
    return NextResponse.json(
      {
        error: "Please continue sign-up on the main Yapp domain.",
        redirectUrl: canonicalRedirect.toString(),
      },
      { status: 409 },
    );
  }

  const parsed = signUpSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid sign-up data." },
      { status: 400 },
    );
  }

  try {
    if (parsed.data.email.endsWith("@trial.local")) {
      return NextResponse.json({ error: "Email is not eligible." }, { status: 400 });
    }

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
