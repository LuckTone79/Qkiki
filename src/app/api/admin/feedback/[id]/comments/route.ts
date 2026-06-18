import { NextResponse } from "next/server";
import { AdminAuditAction } from "@prisma/client";
import {
  adminApiErrorResponse,
  getRequestMeta,
  requireApiAdminViewer,
} from "@/lib/admin-api-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import { MAX_FEEDBACK_BODY_LENGTH } from "@/lib/feedback";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireApiAdminViewer();
    const { id } = await context.params;
    const payload = (await request.json().catch(() => ({}))) as {
      body?: unknown;
    };
    const body = typeof payload.body === "string" ? payload.body.trim() : "";

    if (!body) {
      return NextResponse.json({ error: "Enter a reply." }, { status: 400 });
    }
    if (body.length > MAX_FEEDBACK_BODY_LENGTH) {
      return NextResponse.json(
        { error: "The reply is too long." },
        { status: 400 },
      );
    }

    const post = await prisma.feedbackPost.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!post) {
      return NextResponse.json({ error: "Feedback not found." }, { status: 404 });
    }

    const comment = await prisma.feedbackComment.create({
      data: {
        postId: post.id,
        authorId: admin.id,
        isAdmin: true,
        body,
      },
    });

    // An admin reply notifies the author and clears the admin queue badge.
    await prisma.feedbackPost.update({
      where: { id: post.id },
      data: { userUnread: true, adminUnread: false },
    });

    const meta = getRequestMeta(request);
    await logAdminAudit({
      adminUserId: admin.id,
      action: AdminAuditAction.FEEDBACK_REPLY,
      targetType: "feedback_post",
      targetId: post.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json(
      {
        comment: {
          id: comment.id,
          body: comment.body,
          isAdmin: true,
          authorName: "Yapp",
          createdAt: comment.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
