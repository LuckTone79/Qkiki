import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminSignInSchema } from "@/lib/validation";
import { canViewAdmin } from "@/lib/admin-auth";
import { ensureLegacyUserLinked } from "@/lib/supabase/link-legacy-user";
import { logAdminAudit } from "@/lib/admin-audit";
import { getRequestMeta } from "@/lib/admin-api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { verifyTotp } from "@/lib/totp";

export async function POST(request: Request) {
  const limited = await enforceRateLimit({
    request,
    scope: "admin:sign-in",
    limit: 5,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const parsed = adminSignInSchema.safeParse(await request.json());
  const meta = getRequestMeta(request);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid sign-in data." },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: signInError } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { captchaToken: parsed.data.captchaToken },
  });

  if (signInError || !data.user) {
    await logAdminAudit({
      action: "ADMIN_LOGIN",
      detail: { success: false, reason: "invalid_credentials", email: parsed.data.email },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json(
      { error: "Email or password is incorrect." },
      { status: 401 },
    );
  }

  const user = await ensureLegacyUserLinked(data.user);

  if (!canViewAdmin(user.role)) {
    await supabase.auth.signOut();
    await logAdminAudit({
      adminUserId: user.id,
      action: "ADMIN_LOGIN",
      detail: { success: false, reason: "insufficient_role" },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ error: "Admin permission required." }, { status: 403 });
  }

  if (user.status === "SUSPENDED") {
    await supabase.auth.signOut();
    await logAdminAudit({
      adminUserId: user.id,
      action: "ADMIN_LOGIN",
      detail: { success: false, reason: "suspended" },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ error: "Account suspended." }, { status: 403 });
  }

  const totpSecret = process.env.ADMIN_TOTP_SECRET?.trim();
  if (!totpSecret) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "Admin MFA is unavailable." }, { status: 503 });
  }
  if (!parsed.data.mfaCode || !verifyTotp(parsed.data.mfaCode.trim(), totpSecret)) {
    await supabase.auth.signOut();
    await logAdminAudit({
      adminUserId: user.id,
      action: "ADMIN_MFA_FAILURE",
      detail: { reason: "invalid_code" },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return NextResponse.json({ error: "MFA code is invalid." }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastActiveAt: new Date() },
  });

  await logAdminAudit({
    adminUserId: user.id,
    action: "ADMIN_LOGIN",
    detail: { success: true },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({ ok: true });
}
