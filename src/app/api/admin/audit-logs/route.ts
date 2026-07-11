import { NextResponse } from "next/server";
import {
  adminApiErrorResponse,
  requireApiAdminCritical,
} from "@/lib/admin-api-auth";
import {
  sanitizeAdminAccessReasonCode,
  sanitizeAdminAuditText,
  sanitizeStoredAdminAuditDetailJson,
} from "@/lib/admin-audit-sanitizer";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireApiAdminCritical();

    const [auditLogs, contentAccessLogs] = await Promise.all([
      prisma.adminAuditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 300,
        include: {
          adminUser: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      }),
      prisma.adminContentAccessLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 300,
        include: {
          adminUser: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          viewedUser: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          conversation: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json(
      {
        auditLogs: auditLogs.map((log) => ({
          ...log,
          detailJson: sanitizeStoredAdminAuditDetailJson(log.detailJson),
          userAgent: log.userAgent
            ? sanitizeAdminAuditText(log.userAgent)
            : null,
        })),
        contentAccessLogs: contentAccessLogs.map((log) => ({
          ...log,
          accessReasonCode: sanitizeAdminAccessReasonCode(log.accessReasonCode),
        })),
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
