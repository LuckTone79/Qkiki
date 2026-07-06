import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { removeSessionFromProject } from "@/lib/project-session-removal";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; sessionId: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id: projectId, sessionId } = await context.params;
    const removed = await removeSessionFromProject({
      db: prisma,
      userId: user.id,
      projectId,
      sessionId,
    });

    if (!removed) {
      return NextResponse.json(
        { error: "Session not found in project." },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
