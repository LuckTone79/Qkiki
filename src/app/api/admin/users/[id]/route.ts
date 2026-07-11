import { NextResponse } from "next/server";
import { z } from "zod";
import {
  adminApiErrorResponse,
  assertApiAdminCanMutateUser,
  getRequestMeta,
  requireApiAdminCritical,
  requireApiAdminViewer,
} from "@/lib/admin-api-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";

const statusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireApiAdminViewer();
    const { id } = await context.params;
    const meta = getRequestMeta(request);

    const user = await prisma.user.findUnique({
      where: { id },
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
          take: 30,
          select: {
            id: true,
            title: true,
            mode: true,
            updatedAt: true,
            createdAt: true,
            _count: {
              select: {
                results: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    await logAdminAudit({
      adminUserId: admin.id,
      action: "USER_DETAIL_VIEW",
      targetType: "user",
      targetId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ user });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireApiAdminCritical();
    const { id } = await context.params;
    const meta = getRequestMeta(request);
    const parsed = statusSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid status update." },
        { status: 400 },
      );
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });

    if (!target) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    assertApiAdminCanMutateUser(admin, target);

    const user = await prisma.$transaction(async (tx) => {
      // Keep the privilege check in the write predicate as a defense against
      // a concurrent role elevation between the read and the update.
      const updated = await tx.user.updateMany({
        where: {
          id,
          role: { not: "SUPER_ADMIN" },
        },
        data: { status: parsed.data.status },
      });

      if (updated.count !== 1) {
        return null;
      }

      if (parsed.data.status === "SUSPENDED") {
        await tx.authSession.deleteMany({ where: { userId: id } });
        await tx.adminSession.deleteMany({ where: { userId: id } });
      }

      return tx.user.findUnique({
        where: { id },
        select: { id: true, status: true },
      });
    });

    if (!user) {
      return NextResponse.json(
        { error: "This account can no longer be modified." },
        { status: 409 },
      );
    }

    await logAdminAudit({
      adminUserId: admin.id,
      action: parsed.data.status === "SUSPENDED" ? "USER_SUSPEND" : "USER_UNSUSPEND",
      targetType: "user",
      targetId: id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ user });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
