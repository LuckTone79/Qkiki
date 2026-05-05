import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { projectSchema } from "@/lib/validation";

export async function GET() {
  try {
    const user = await requireApiUser();
    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { sessions: true } },
        sessions: {
          orderBy: { updatedAt: "desc" },
          take: 3,
          select: {
            id: true,
            title: true,
            updatedAt: true,
            _count: { select: { results: true } },
          },
        },
      },
    });

    return NextResponse.json({ projects });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const parsed = projectSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid project." },
        { status: 400 },
      );
    }

    const project = await prisma.project.create({
      data: {
        userId: user.id,
        name: parsed.data.name,
        description: parsed.data.description || null,
        sharedContext: parsed.data.sharedContext || null,
      },
    });

    return NextResponse.json({ project });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
