import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// Removes a collected item from the project. The source session/result is left
// untouched — only the project registration is deleted.
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id: projectId, itemId } = await context.params;

    const item = await prisma.projectItem.findFirst({
      where: { id: itemId, projectId, userId: user.id },
      select: { id: true },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }

    await prisma.projectItem.delete({ where: { id: item.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
