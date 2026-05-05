import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

async function collectBranchIds(rootId: string) {
  const collected = new Set<string>([rootId]);
  let frontier = [rootId];

  while (frontier.length) {
    const children = await prisma.result.findMany({
      where: { parentResultId: { in: frontier } },
      select: { id: true },
    });
    frontier = children
      .map((child) => child.id)
      .filter((id) => !collected.has(id));
    frontier.forEach((id) => collected.add(id));
  }

  return Array.from(collected);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const result = await prisma.result.findFirst({
      where: { id, session: { userId: user.id } },
    });

    if (!result) {
      return NextResponse.json({ error: "Result not found." }, { status: 404 });
    }

    const branchIds = await collectBranchIds(result.id);
    const session = await prisma.workbenchSession.findFirst({
      where: { id: result.sessionId, userId: user.id },
    });

    if (session?.finalResultId && branchIds.includes(session.finalResultId)) {
      await prisma.workbenchSession.update({
        where: { id: session.id },
        data: { finalResultId: null },
      });
    }

    await prisma.result.deleteMany({
      where: { id: { in: branchIds }, session: { userId: user.id } },
    });

    return NextResponse.json({ ok: true, deletedIds: branchIds });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
