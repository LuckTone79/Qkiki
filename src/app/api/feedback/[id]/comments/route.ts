import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { MAX_FEEDBACK_BODY_LENGTH } from "@/lib/feedback";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const payload = (await request.json().catch(() => ({}))) as {
      body?: unknown;
    };
    const body = typeof payload.body === "string" ? payload.body.trim() : "";

    if (!body) {
      return NextResponse.json(
        { error: "Enter a message." },
        { status: 400 },
      );
    }
    if (body.length > MAX_FEEDBACK_BODY_LENGTH) {
      return NextResponse.json(
        { error: "The message is too long." },
        { status: 400 },
      );
    }

    const post = await prisma.feedbackPost.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Feedback not found." }, { status: 404 });
    }

    const comment = await prisma.feedbackComment.create({
      data: {
        postId: post.id,
        authorId: user.id,
        isAdmin: false,
        body,
      },
    });

    // A new author message re-opens admin attention.
    await prisma.feedbackPost.update({
      where: { id: post.id },
      data: { adminUnread: true },
    });

    return NextResponse.json(
      {
        comment: {
          id: comment.id,
          body: comment.body,
          isAdmin: false,
          authorName: user.name || user.email,
          createdAt: comment.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
