import { NextResponse } from "next/server";
import { adminApiErrorResponse, requireApiAdminViewer } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    await requireApiAdminViewer();
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() || "";
    const userId = url.searchParams.get("userId")?.trim() || "";

    const where =
      q || userId
        ? {
            AND: [
              ...(q
                ? [
                    {
                      OR: [
                        { title: { contains: q } },
                        { user: { email: { contains: q } } },
                        { user: { name: { contains: q } } },
                      ],
                    },
                  ]
                : []),
              ...(userId ? [{ userId }] : []),
            ],
          }
        : undefined;

    const sessions = await prisma.workbenchSession.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        userId: true,
        title: true,
        mode: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
        _count: {
          select: {
            results: true,
            workflowSteps: true,
          },
        },
      },
    });

    return NextResponse.json({ conversations: sessions });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
