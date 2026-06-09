import { NextResponse } from "next/server";
import { FeedbackCategory } from "@prisma/client";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  claimFeedbackAttachments,
  extractReferencedAttachmentIds,
  FEEDBACK_CATEGORIES,
  MAX_FEEDBACK_BODY_LENGTH,
  MAX_FEEDBACK_TITLE_LENGTH,
} from "@/lib/feedback";

export async function GET() {
  try {
    const user = await requireApiUser();
    const posts = await prisma.feedbackPost.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        category: true,
        status: true,
        userUnread: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { comments: true } },
      },
    });

    return NextResponse.json({
      posts: posts.map((post) => ({
        id: post.id,
        title: post.title,
        category: post.category,
        status: post.status,
        hasUnread: post.userUnread,
        commentCount: post._count.comments,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const payload = (await request.json().catch(() => ({}))) as {
      title?: unknown;
      body?: unknown;
      category?: unknown;
      attachmentIds?: unknown;
    };

    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    const body = typeof payload.body === "string" ? payload.body.trim() : "";
    const category =
      typeof payload.category === "string" &&
      (FEEDBACK_CATEGORIES as readonly string[]).includes(payload.category)
        ? (payload.category as FeedbackCategory)
        : FeedbackCategory.OTHER;
    const explicitAttachmentIds = Array.isArray(payload.attachmentIds)
      ? payload.attachmentIds.filter(
          (value): value is string => typeof value === "string",
        )
      : [];

    if (!title) {
      return NextResponse.json(
        { error: "Enter a title for your feedback." },
        { status: 400 },
      );
    }
    if (title.length > MAX_FEEDBACK_TITLE_LENGTH) {
      return NextResponse.json(
        { error: "The title is too long." },
        { status: 400 },
      );
    }
    if (!body) {
      return NextResponse.json(
        { error: "Enter the details of your feedback." },
        { status: 400 },
      );
    }
    if (body.length > MAX_FEEDBACK_BODY_LENGTH) {
      return NextResponse.json(
        { error: "The body is too long." },
        { status: 400 },
      );
    }

    const post = await prisma.feedbackPost.create({
      data: {
        userId: user.id,
        title,
        body,
        category,
      },
      select: { id: true },
    });

    const attachmentIds = Array.from(
      new Set([...explicitAttachmentIds, ...extractReferencedAttachmentIds(body)]),
    );
    await claimFeedbackAttachments({
      userId: user.id,
      postId: post.id,
      attachmentIds,
    });

    return NextResponse.json({ post: { id: post.id } }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
