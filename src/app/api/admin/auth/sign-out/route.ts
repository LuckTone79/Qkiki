import { NextResponse } from "next/server";
import { clearAdminSession, getCurrentAdmin } from "@/lib/admin-auth";
import { getRequestMeta } from "@/lib/admin-api-auth";
import { logAdminAudit } from "@/lib/admin-audit";

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  const meta = getRequestMeta(request);

  await clearAdminSession();

  if (admin) {
    await logAdminAudit({
      adminUserId: admin.id,
      action: "ADMIN_LOGOUT",
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  return NextResponse.json({ ok: true });
}
