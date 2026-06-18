import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { toFeedbackAttachmentMeta } from "@/lib/feedback";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;

    const post = await prisma.feedbackPost.findFirst({
      where: { id, userId: user.id },
      include: {
        attachments: { orderBy: { createdAt: "asc" } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: {
            author: { select: { name: true, email: true } },
          },
        },
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Feedback not found." }, { status: 404 });
    }

    // Viewing the thread clears the "new reply" badge for the author.
    if (post.userUnread) {
      await prisma.feedbackPost.update({
        where: { id: post.id },
        data: { userUnread: false },
      });
    }

    return NextResponse.json({
      post: {
        id: post.id,
        title: post.title,
        body: post.body,
        category: post.category,
        status: post.status,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
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
    return apiErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;

    const post = await prisma.feedbackPost.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Feedback not found." }, { status: 404 });
    }

    await prisma.feedbackPost.delete({ where: { id: post.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
