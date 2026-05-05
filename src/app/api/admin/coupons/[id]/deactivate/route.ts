import { NextResponse } from "next/server";
import {
  adminApiErrorResponse,
  getRequestMeta,
  requireApiAdminManager,
} from "@/lib/admin-api-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireApiAdminManager();
    const { id } = await context.params;
    const meta = getRequestMeta(request);

    const coupon = await prisma.coupon.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, code: true, isActive: true },
    });

    await logAdminAudit({
      adminUserId: admin.id,
      action: "COUPON_DEACTIVATE",
      targetType: "coupon",
      targetId: coupon.id,
      detail: {
        code: coupon.code,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ coupon });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
