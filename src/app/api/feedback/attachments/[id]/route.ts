import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// Removes a pending (not yet attached to a post) image the user uploaded while
// composing. Attachments already linked to a post are removed with the post.
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;

    const attachment = await prisma.feedbackAttachment.findFirst({
      where: { id, userId: user.id },
      select: { id: true, postId: true },
    });

    if (!attachment) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (attachment.postId) {
      return NextResponse.json(
        { error: "This image is already attached to a post." },
        { status: 409 },
      );
    }

    await prisma.feedbackAttachment.delete({ where: { id: attachment.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
