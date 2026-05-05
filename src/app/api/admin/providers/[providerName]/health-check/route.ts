import { NextResponse } from "next/server";
import {
  adminApiErrorResponse,
  getRequestMeta,
  requireApiAdminManager,
} from "@/lib/admin-api-auth";
import { PROVIDERS, isProviderName } from "@/lib/ai/provider-catalog";
import { logAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  context: { params: Promise<{ providerName: string }> },
) {
  try {
    const admin = await requireApiAdminManager();
    const meta = getRequestMeta(request);
    const { providerName } = await context.params;

    if (!isProviderName(providerName)) {
      return NextResponse.json({ error: "Unsupported provider." }, { status: 400 });
    }

    const catalog = PROVIDERS.find((provider) => provider.name === providerName);
    const config = await prisma.adminProviderConfig.findUnique({
      where: { providerName },
    });
    const hasEnvKey = Boolean(catalog && process.env[catalog.envKey]?.trim());
    const hasStoredKey = Boolean(config?.apiKeyCiphertext);
    const healthStatus = !config?.isEnabled
      ? "disabled"
      : hasEnvKey || hasStoredKey
        ? "ready"
        : "missing_key";
    const checkedAt = new Date();

    const updated = await prisma.adminProviderConfig.upsert({
      where: { providerName },
      create: {
        providerName,
        defaultModel: catalog?.defaultModel ?? providerName,
        isEnabled: false,
        healthStatus,
        lastHealthCheckedAt: checkedAt,
        updatedByAdminId: admin.id,
      },
      update: {
        healthStatus,
        lastHealthCheckedAt: checkedAt,
        updatedByAdminId: admin.id,
      },
    });

    await logAdminAudit({
      adminUserId: admin.id,
      action: "SYSTEM_SETTING_CHANGE",
      targetType: "provider",
      targetId: providerName,
      detail: { healthCheck: healthStatus },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({
      provider: {
        providerName: updated.providerName,
        healthStatus: updated.healthStatus,
        lastHealthCheckedAt: updated.lastHealthCheckedAt,
      },
    });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
