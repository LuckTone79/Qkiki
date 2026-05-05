import { NextResponse } from "next/server";
import { z } from "zod";
import {
  adminApiErrorResponse,
  getRequestMeta,
  requireApiAdminManager,
} from "@/lib/admin-api-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  settingKey: z.string().trim().min(1).max(120),
  valueJson: z.string().min(2).max(20000),
});

export async function GET() {
  try {
    await requireApiAdminManager();
    const settings = await prisma.adminSystemSetting.findMany({
      orderBy: { updatedAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ settings });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await requireApiAdminManager();
    const parsed = schema.safeParse(await request.json());
    const meta = getRequestMeta(request);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid system setting payload." },
        { status: 400 },
      );
    }

    const setting = await prisma.adminSystemSetting.upsert({
      where: { settingKey: parsed.data.settingKey },
      create: {
        settingKey: parsed.data.settingKey,
        valueJson: parsed.data.valueJson,
        updatedByAdminId: admin.id,
      },
      update: {
        valueJson: parsed.data.valueJson,
        updatedByAdminId: admin.id,
      },
    });

    await logAdminAudit({
      adminUserId: admin.id,
      action: "SYSTEM_SETTING_CHANGE",
      targetType: "system_setting",
      targetId: setting.settingKey,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ setting });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
