import { NextResponse } from "next/server";
import { AdminAuditAction, FeedbackStatus } from "@prisma/client";
import {
  adminApiErrorResponse,
  getRequestMeta,
  requireApiAdminManager,
  requireApiAdminViewer,
} from "@/lib/admin-api-auth";
import { canManageAdmin } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import { FEEDBACK_STATUSES, toFeedbackAttachmentMeta } from "@/lib/feedback";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireApiAdminViewer();
    const { id } = await context.params;

    const post = await prisma.feedbackPost.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true } },
        attachments: { orderBy: { createdAt: "asc" } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { name: true, email: true } } },
        },
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Feedback not found." }, { status: 404 });
    }

    if (post.adminUnread && canManageAdmin(admin.role)) {
      await prisma.feedbackPost.update({
        where: { id: post.id },
        data: { adminUnread: false },
      });
    }

    const meta = getRequestMeta(request);
    await logAdminAudit({
      adminUserId: admin.id,
      action: AdminAuditAction.FEEDBACK_VIEW,
      targetType: "feedback_post",
      targetId: post.id,
      detail: { viewedUserId: post.userId },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({
      post: {
        id: post.id,
        title: post.title,
        body: post.body,
        category: post.category,
        status: post.status,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        user: {
          id: post.user.id,
          email: post.user.email,
          name: post.user.name,
        },
        attachments: post.attachments.map(toFeedbackAttachmentMeta),
        comments: post.comments.map((comment) => ({
          id: comment.id,
          body: comment.body,
          isAdmin: comment.isAdmin,
          authorName: comment.isAdmin
            ? "Yapp"
            : comment.author.name || comment.author.email,
          createdAt: comment.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireApiAdminManager();
    const { id } = await context.params;
    const payload = (await request.json().catch(() => ({}))) as {
      status?: unknown;
    };

    const status =
      typeof payload.status === "string" &&
      (FEEDBACK_STATUSES as readonly string[]).includes(payload.status)
        ? (payload.status as FeedbackStatus)
        : null;

    if (!status) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    const existing = await prisma.feedbackPost.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Feedback not found." }, { status: 404 });
    }

    await prisma.feedbackPost.update({
      where: { id },
      data: { status, userUnread: true },
    });

    const meta = getRequestMeta(request);
    await logAdminAudit({
      adminUserId: admin.id,
      action: AdminAuditAction.FEEDBACK_STATUS_CHANGE,
      targetType: "feedback_post",
      targetId: id,
      detail: { from: existing.status, to: status },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true, status });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
