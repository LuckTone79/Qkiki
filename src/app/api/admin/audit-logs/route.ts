import { NextResponse } from "next/server";
import { adminApiErrorResponse, requireApiAdminViewer } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireApiAdminViewer();

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

    return NextResponse.json({ auditLogs, contentAccessLogs });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
