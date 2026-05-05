import { NextResponse } from "next/server";
import {
  adminApiErrorResponse,
  getRequestMeta,
  requireApiAdminManager,
} from "@/lib/admin-api-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireApiAdminManager();
    const { id } = await context.params;
    const meta = getRequestMeta(request);

    const coupon = await prisma.coupon.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        redeemedAt: true,
      },
    });

    if (!coupon) {
      return NextResponse.json({ error: "Coupon not found." }, { status: 404 });
    }

    if (coupon.redeemedAt) {
      return NextResponse.json(
        { error: "Used coupons cannot be deleted." },
        { status: 409 },
      );
    }

    await prisma.coupon.delete({
      where: { id: coupon.id },
    });

    await logAdminAudit({
      adminUserId: admin.id,
      action: "COUPON_DEACTIVATE",
      targetType: "coupon",
      targetId: coupon.id,
      detail: {
        code: coupon.code,
        operation: "delete",
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ deleted: true, id: coupon.id });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
