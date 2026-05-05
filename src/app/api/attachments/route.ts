import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { createAttachment } from "@/lib/attachments";
import { prisma } from "@/lib/prisma";

function attachmentErrorResponse(error: unknown) {
  if (!(error instanceof Error)) {
    return apiErrorResponse(error);
  }

  if (error.message.includes("smaller") || error.message.includes("Supported attachments")) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return apiErrorResponse(error);
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const formData = await request.formData();
    const file = formData.get("file");
    const sessionIdValue = formData.get("sessionId");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Select a file to upload." }, { status: 400 });
    }

    const sessionId =
      typeof sessionIdValue === "string" && sessionIdValue.trim()
        ? sessionIdValue.trim()
        : null;

    if (sessionId) {
      const session = await prisma.workbenchSession.findFirst({
        where: { id: sessionId, userId: user.id },
        select: { id: true },
      });

      if (!session) {
        return NextResponse.json({ error: "Session not found." }, { status: 404 });
      }
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const attachment = await createAttachment({
      userId: user.id,
      sessionId,
      fileName: file.name,
      mimeType: file.type,
      bytes,
    });

    return NextResponse.json({ attachment });
  } catch (error) {
    return attachmentErrorResponse(error);
  }
}
