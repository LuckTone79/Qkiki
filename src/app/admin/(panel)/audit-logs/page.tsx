import { prisma } from "@/lib/prisma";
import {
  AdminAuditLogsClient,
  type AuditLogItem,
  type ContentAccessLogItem,
} from "@/components/admin/AdminAuditLogsClient";

export const dynamic = "force-dynamic";

export default async function AdminAuditLogsPage() {
  const [auditLogs, contentAccessLogs] = await Promise.all([
    prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
      include: {
        adminUser: { select: { email: true, name: true } },
      },
    }),
    prisma.adminContentAccessLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
      include: {
        adminUser: { select: { email: true, name: true } },
        viewedUser: { select: { email: true, name: true } },
        conversation: { select: { title: true } },
      },
    }),
  ]);

  const auditItems: AuditLogItem[] = auditLogs.map((log) => ({
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    adminName: log.adminUser?.name || log.adminUser?.email || "-",
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
    detailJson: log.detailJson,
  }));

  const contentItems: ContentAccessLogItem[] = contentAccessLogs.map((log) => ({
    id: log.id,
    createdAt: log.createdAt.toISOString(),
    adminName: log.adminUser?.name || log.adminUser?.email || "-",
    viewedUserName: log.viewedUser?.name || log.viewedUser?.email || "-",
    conversationTitle: log.conversation?.title ?? null,
    accessReasonCode: log.accessReasonCode,
  }));

  return <AdminAuditLogsClient auditLogs={auditItems} contentAccessLogs={contentItems} />;
}
