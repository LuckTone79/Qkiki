import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const session = await prisma.workbenchSession.findFirst({
      where: { id, userId: user.id },
      include: {
        project: { select: { id: true, name: true, sharedContext: true } },
        workflowSteps: { orderBy: { orderIndex: "asc" } },
        results: {
          orderBy: { createdAt: "asc" },
          include: {
            workflowStep: {
              select: { orderIndex: true, actionType: true },
            },
          },
        },
        attachments: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            mimeType: true,
            kind: true,
            sizeBytes: true,
            createdAt: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    return NextResponse.json({ session });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const body = (await request.json()) as {
      title?: string;
      finalResultId?: string | null;
    };
    const session = await prisma.workbenchSession.findFirst({
      where: { id, userId: user.id },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    if (body.finalResultId) {
      const result = await prisma.result.findFirst({
        where: {
          id: body.finalResultId,
          sessionId: session.id,
          session: { userId: user.id },
        },
      });

      if (!result) {
        return NextResponse.json(
          { error: "Final result does not belong to this session." },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.workbenchSession.update({
      where: { id: session.id },
      data: {
        ...(body.title !== undefined ? { title: body.title.slice(0, 160) } : {}),
        ...(body.finalResultId !== undefined
          ? { finalResultId: body.finalResultId }
          : {}),
      },
    });

    return NextResponse.json({ session: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const session = await prisma.workbenchSession.findFirst({
      where: { id, userId: user.id },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    await prisma.workbenchSession.delete({ where: { id: session.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
