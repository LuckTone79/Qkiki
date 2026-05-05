import { NextResponse } from "next/server";
import {
  adminApiErrorResponse,
  getRequestMeta,
  requireApiAdminManager,
} from "@/lib/admin-api-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { grantManualSubscription } from "@/lib/subscription";
import { manualGrantSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireApiAdminManager();
    const { id } = await context.params;
    const meta = getRequestMeta(request);
    const parsed = manualGrantSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid grant request." },
        { status: 400 },
      );
    }

    const result = await grantManualSubscription({
      targetUserId: id,
      adminUserId: admin.id,
      type: parsed.data.type,
      note: parsed.data.note,
    });

    await logAdminAudit({
      adminUserId: admin.id,
      action: "SUBSCRIPTION_MANUAL_GRANT",
      targetType: "user",
      targetId: id,
      detail: {
        type: parsed.data.type,
        result: result.result,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ result });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
