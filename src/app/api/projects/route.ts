import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { projectSchema } from "@/lib/validation";
import { listProjectsForUser } from "@/server/app-data/projects";

export async function GET() {
  try {
    const user = await requireApiUser();
    const projects = await listProjectsForUser(user.id);

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
