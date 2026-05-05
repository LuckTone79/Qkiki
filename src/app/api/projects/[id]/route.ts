import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { projectSchema } from "@/lib/validation";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const project = await prisma.project.findFirst({
      where: { id, userId: user.id },
      include: {
        sessions: {
          orderBy: { updatedAt: "desc" },
          include: {
            _count: { select: { results: true, workflowSteps: true } },
          },
        },
        _count: { select: { sessions: true } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    return NextResponse.json({ project });
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
    const parsed = projectSchema.partial().safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid project." },
        { status: 400 },
      );
    }

    const existing = await prisma.project.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const project = await prisma.project.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined
          ? { description: parsed.data.description || null }
          : {}),
        ...(parsed.data.sharedContext !== undefined
          ? { sharedContext: parsed.data.sharedContext || null }
          : {}),
      },
    });

    return NextResponse.json({ project });
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
    const existing = await prisma.project.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    await prisma.project.delete({ where: { id: existing.id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
