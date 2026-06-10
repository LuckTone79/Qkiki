import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { createFeedbackAttachment } from "@/lib/feedback";

function feedbackAttachmentError(error: unknown) {
  if (
    error instanceof Error &&
    (error.message.includes("smaller") ||
      error.message.includes("images can be attached") ||
      error.message.includes("up to"))
  ) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return apiErrorResponse(error);
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Select an image to upload." },
        { status: 400 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const attachment = await createFeedbackAttachment({
      userId: user.id,
      fileName: file.name || "image",
      mimeType: file.type,
      bytes,
    });

    return NextResponse.json({ attachment });
  } catch (error) {
    return feedbackAttachmentError(error);
  }
}
