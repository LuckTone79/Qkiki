import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readFeedbackAttachmentBytes } from "@/lib/feedback";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const attachment = await prisma.feedbackAttachment.findUnique({
    where: { id },
  });

  if (!attachment) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // The author (regular session) or any admin (admin session) may view it.
  const user = await getCurrentUser();
  let authorized = Boolean(user && user.id === attachment.userId);

  if (!authorized) {
    const admin = await getCurrentAdmin();
    authorized = Boolean(admin);
  }

  if (!authorized) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const bytes = await readFeedbackAttachmentBytes(attachment);
  if (!bytes) {
    return NextResponse.json({ error: "Image unavailable." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.name)}"`,
    },
  });
}
