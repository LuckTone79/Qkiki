import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { couponRedeemSchema } from "@/lib/validation";
import { CouponRedeemError, redeemCouponCode } from "@/lib/subscription";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const parsed = couponRedeemSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid coupon request." },
        { status: 400 },
      );
    }

    const result = await redeemCouponCode({
      userId: user.id,
      couponCode: parsed.data.code,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CouponRedeemError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return apiErrorResponse(error);
  }
}
