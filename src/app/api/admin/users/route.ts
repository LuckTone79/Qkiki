import { NextResponse } from "next/server";
import { adminApiErrorResponse, requireApiAdminViewer } from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    await requireApiAdminViewer();

    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() || "";
    const all = url.searchParams.get("all") === "1";

    const users = await prisma.user.findMany({
      where: q
        ? {
            OR: [
              { email: { contains: q } },
              { name: { contains: q } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: all ? undefined : 100,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        lastActiveAt: true,
        subscription: {
          select: {
            isLifetime: true,
            planEndsAt: true,
          },
        },
        sessions: {
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { updatedAt: true },
        },
      },
    });

    const payload = users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      lastActiveAt:
        user.lastActiveAt || user.sessions[0]?.updatedAt || user.createdAt,
      subscription: user.subscription
        ? {
            isLifetime: user.subscription.isLifetime,
            planEndsAt: user.subscription.planEndsAt,
          }
        : {
            isLifetime: false,
            planEndsAt: null,
          },
    }));

    return NextResponse.json({ users: payload });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
