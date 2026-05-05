import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { deleteAttachment } from "@/lib/attachments";

function attachmentDeleteError(error: unknown) {
  if (!(error instanceof Error)) {
    return apiErrorResponse(error);
  }

  if (error.message.includes("not found")) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  if (error.message.includes("cannot be removed")) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  return apiErrorResponse(error);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    await deleteAttachment({ id, userId: user.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return attachmentDeleteError(error);
  }
}
