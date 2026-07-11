import { NextResponse } from "next/server";
import { CouponRedemptionResult, CouponType } from "@prisma/client";
import {
  adminApiErrorResponse,
  getRequestMeta,
  requireApiAdminManager,
} from "@/lib/admin-api-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { normalizeCouponNote } from "@/lib/coupon-note";
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
            creditAmount: true,
            creditExpiresAt: true,
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

    return NextResponse.json(
      { coupons: payload },
      { headers: { "Cache-Control": "private, no-store" } },
    );
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

    const { duration, unlimited, quantity } = parsed.data;
    const type: CouponType = unlimited
      ? duration === "lifetime"
        ? CouponType.UNLIMITED_LIFETIME
        : duration === "30d"
          ? CouponType.UNLIMITED_30D
          : CouponType.UNLIMITED_7D
      : duration === "lifetime"
        ? CouponType.CREDIT_LIFETIME
        : duration === "30d"
          ? CouponType.CREDIT_30D
          : CouponType.CREDIT_7D;
    const creditAmount = unlimited ? null : parsed.data.creditAmount ?? null;

    // Create `quantity` identical coupons, each with a unique code. A custom
    // code is only allowed for a single coupon (enforced by the schema).
    const usedCodes = new Set<string>();
    const coupons: { id: string; code: string; type: CouponType }[] = [];
    for (let i = 0; i < quantity; i += 1) {
      let code = (
        quantity === 1 && parsed.data.code?.trim()
          ? parsed.data.code.trim().toUpperCase()
          : generateCouponCode(type)
      ).slice(0, 64);
      while (usedCodes.has(code)) {
        code = generateCouponCode(type).slice(0, 64);
      }
      usedCodes.add(code);

      const coupon = await prisma.coupon.create({
        data: {
          code,
          type,
          creditAmount,
          note: normalizeCouponNote(parsed.data.note),
          createdByAdminId: admin.id,
        },
      });
      coupons.push({ id: coupon.id, code: coupon.code, type: coupon.type });

      await logAdminAudit({
        adminUserId: admin.id,
        action: "COUPON_CREATE",
        targetType: "coupon",
        targetId: coupon.id,
        detail: {
          type: coupon.type,
          creditAmount,
          noteProvided: Boolean(coupon.note),
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    }

    return NextResponse.json(
      { coupons, coupon: coupons[0] },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Coupon code already exists." }, { status: 409 });
    }
    return adminApiErrorResponse(error);
  }
}
