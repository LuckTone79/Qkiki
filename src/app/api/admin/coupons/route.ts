import { NextResponse } from "next/server";
import { CouponRedemptionResult, CouponType } from "@prisma/client";
import {
  adminApiErrorResponse,
  getRequestMeta,
  requireApiAdminManager,
} from "@/lib/admin-api-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import { generateCouponCode } from "@/lib/subscription";
import { couponCreateSchema } from "@/lib/validation";

export async function GET() {
  try {
    await requireApiAdminManager();

    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        createdByAdmin: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        redeemedByUser: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        redemptions: {
          where: {
            result: {
              in: [
                CouponRedemptionResult.APPLIED,
                CouponRedemptionResult.ALREADY_LIFETIME,
              ],
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            result: true,
            grantStartAt: true,
            grantEndAt: true,
            grantIsLifetime: true,
            createdAt: true,
          },
        },
      },
    });

    const now = Date.now();
    const payload = coupons.map((coupon) => {
      const appliedRedemption = coupon.redemptions[0] ?? null;
      const isInUse = Boolean(
        appliedRedemption &&
          (appliedRedemption.grantIsLifetime ||
            (appliedRedemption.grantEndAt &&
              appliedRedemption.grantEndAt.getTime() > now)),
      );

      const usageStatus = coupon.redeemedAt
        ? isInUse
          ? "IN_USE"
          : "USED"
        : coupon.isActive
          ? "ACTIVE"
          : "INACTIVE";

      return {
        ...coupon,
        appliedRedemption,
        usageStatus,
      };
    });

    return NextResponse.json({ coupons: payload });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireApiAdminManager();
    const meta = getRequestMeta(request);
    const parsed = couponCreateSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid coupon create request." },
        { status: 400 },
      );
    }

    const type = parsed.data.type as CouponType;
    const code = (parsed.data.code?.trim().toUpperCase() || generateCouponCode(type)).slice(0, 64);

    const coupon = await prisma.coupon.create({
      data: {
        code,
        type,
        note: parsed.data.note || null,
        createdByAdminId: admin.id,
      },
    });

    await logAdminAudit({
      adminUserId: admin.id,
      action: "COUPON_CREATE",
      targetType: "coupon",
      targetId: coupon.id,
      detail: {
        code: coupon.code,
        type: coupon.type,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ coupon });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Coupon code already exists." }, { status: 409 });
    }
    return adminApiErrorResponse(error);
  }
}
