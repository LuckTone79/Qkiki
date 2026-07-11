import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuthSession, verifyPassword } from "@/lib/auth";
import { getAuthRuntimeDiagnostics } from "@/lib/auth-config";
import { buildCanonicalRedirectUrl } from "@/lib/canonical-host";
import { enforceRateLimit } from "@/lib/rate-limit";
import { signInSchema } from "@/lib/validation";

const DUMMY_PASSWORD_HASH =
  "$2b$12$sIp.SfxT2prxayqAGwlPL.ZUg4eAdfsf5eZRTj756hI/z6vLZk7MG";

export async function POST(request: Request) {
  const limited = await enforceRateLimit({
    request,
    scope: "auth:sign-in",
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) {
    return limited;
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
    canonicalRedirect.pathname = "/sign-in";
    canonicalRedirect.search = "";
    return NextResponse.json(
      {
        error: "Please continue sign-in on the main Yapp domain.",
        redirectUrl: canonicalRedirect.toString(),
      },
      { status: 409 },
    );
  }

  const parsed = signInSchema.safeParse(await request.json().catch(() => null));

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

    const passwordMatches = await verifyPassword(
      parsed.data.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !passwordMatches) {
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
