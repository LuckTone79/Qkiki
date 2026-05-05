import "server-only";

import { AdminAuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AdminAuditInput = {
  adminUserId?: string | null;
  action: AdminAuditAction;
  targetType?: string;
  targetId?: string;
  detail?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function logAdminAudit(input: AdminAuditInput) {
  await prisma.adminAuditLog.create({
    data: {
      adminUserId: input.adminUserId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      detailJson: input.detail ? JSON.stringify(input.detail) : null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
