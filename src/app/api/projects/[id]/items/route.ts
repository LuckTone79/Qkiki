import { NextResponse } from "next/server";
import { ProjectItemKind } from "@prisma/client";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const MAX_ITEM_TITLE_LENGTH = 300;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id: projectId } = await context.params;
    const payload = (await request.json().catch(() => ({}))) as {
      kind?: unknown;
      sessionId?: unknown;
      resultId?: unknown;
      title?: unknown;
      note?: unknown;
    };

    const kind =
      payload.kind === "SESSION" || payload.kind === "RESULT"
        ? (payload.kind as ProjectItemKind)
        : null;
    const sessionId =
      typeof payload.sessionId === "string" ? payload.sessionId.trim() : "";
    const resultId =
      typeof payload.resultId === "string" ? payload.resultId.trim() : "";
    const note = typeof payload.note === "string" ? payload.note.trim() : null;

    if (!kind) {
      return NextResponse.json({ error: "Invalid item type." }, { status: 400 });
    }
    if (!sessionId) {
      return NextResponse.json(
        { error: "Session id is required." },
        { status: 400 },
      );
    }
    if (kind === "RESULT" && !resultId) {
      return NextResponse.json(
        { error: "Result id is required." },
        { status: 400 },
      );
    }

    // Confirm ownership of the project and the source session/result.
    const [project, session] = await Promise.all([
      prisma.project.findFirst({
        where: { id: projectId, userId: user.id },
        select: { id: true },
      }),
      prisma.workbenchSession.findFirst({
        where: { id: sessionId, userId: user.id },
        select: { id: true, title: true },
      }),
    ]);

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    let title =
      typeof payload.title === "string" && payload.title.trim()
        ? payload.title.trim()
        : session.title;

    if (kind === "RESULT") {
      const result = await prisma.result.findFirst({
        where: { id: resultId, sessionId: session.id },
        select: { id: true },
      });
      if (!result) {
        return NextResponse.json(
          { error: "Result not found in this session." },
          { status: 404 },
        );
      }
    }

    title = title.slice(0, MAX_ITEM_TITLE_LENGTH);

    // Avoid registering the same session/result twice in one project.
    const existing = await prisma.projectItem.findFirst({
      where: {
        projectId: project.id,
        kind,
        ...(kind === "RESULT"
          ? { resultId }
          : { sessionId: session.id, resultId: null }),
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: "This item is already in the project.",
          code: "ALREADY_ADDED",
        },
        { status: 409 },
      );
    }

    const item = await prisma.projectItem.create({
      data: {
        projectId: project.id,
        userId: user.id,
        kind,
        sessionId: session.id,
        resultId: kind === "RESULT" ? resultId : null,
        title,
        note,
      },
      select: { id: true },
    });

    return NextResponse.json({ item: { id: item.id } }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
