import { NextResponse } from "next/server";
import {
  adminApiErrorResponse,
  getRequestMeta,
  requireApiAdminManager,
} from "@/lib/admin-api-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import { revokeCouponGrantForUserByAdmin } from "@/lib/subscription";

export async function POST(
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
        isActive: true,
        type: true,
        redeemedByUserId: true,
      },
    });

    if (!coupon) {
      return NextResponse.json({ error: "Coupon not found." }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.coupon.update({
        where: { id: coupon.id },
        data: { isActive: false },
      });

      if (coupon.isActive && coupon.redeemedByUserId) {
        await revokeCouponGrantForUserByAdmin(tx, {
          userId: coupon.redeemedByUserId,
          couponId: coupon.id,
          couponType: coupon.type,
          reason: "deactivate",
        });
      }
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

    return NextResponse.json({
      coupon: {
        id: coupon.id,
        code: coupon.code,
        isActive: false,
      },
    });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
