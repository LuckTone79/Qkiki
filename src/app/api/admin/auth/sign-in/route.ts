import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminSignInSchema } from "@/lib/validation";
import { verifyPassword } from "@/lib/auth";
import { canViewAdmin, createAdminSession } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { getRequestMeta } from "@/lib/admin-api-auth";

export async function POST(request: Request) {
  const parsed = adminSignInSchema.safeParse(await request.json());
  const meta = getRequestMeta(request);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid sign-in data." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
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

  if (!canViewAdmin(user.role)) {
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
    await logAdminAudit({
      adminUserId: user.id,
      action: "ADMIN_LOGIN",
      detail: { success: false, reason: "suspended" },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ error: "Account suspended." }, { status: 403 });
  }

  const expectedMfaCode = process.env.ADMIN_MFA_CODE?.trim();
  const providedMfaCode = parsed.data.mfaCode?.trim();

  if (!expectedMfaCode) {
    await logAdminAudit({
      adminUserId: user.id,
      action: "ADMIN_MFA_FAILURE",
      detail: { reason: "mfa_not_configured" },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json(
      { error: "Admin MFA is required but ADMIN_MFA_CODE is not configured." },
      { status: 503 },
    );
  }

  if (!providedMfaCode || providedMfaCode !== expectedMfaCode) {
    await logAdminAudit({
      adminUserId: user.id,
      action: "ADMIN_MFA_FAILURE",
      detail: { reason: "invalid_code" },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json(
      { error: "MFA code is invalid." },
      { status: 401 },
    );
  }

  await logAdminAudit({
    adminUserId: user.id,
    action: "ADMIN_MFA_SUCCESS",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  const mfaVerifiedAt = new Date();
  await createAdminSession(user.id, mfaVerifiedAt);

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
