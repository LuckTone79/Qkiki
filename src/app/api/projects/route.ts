import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { projectSchema } from "@/lib/validation";
import { createRouteTiming } from "@/server/perf/route-timing";

export async function GET() {
  const timing = createRouteTiming();

  try {
    const user = await timing.time("auth", () => requireApiUser());
    const projects = await timing.query("project_list", () =>
      prisma.project.findMany({
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
      }),
    );

    return timing.response(NextResponse.json({ projects }));
  } catch (error) {
    return timing.response(apiErrorResponse(error));
  }
}

export async function POST(request: Request) {
  const timing = createRouteTiming();

  try {
    const user = await timing.time("auth", () => requireApiUser());
    const parsed = projectSchema.safeParse(
      await timing.time("parse_body", () => request.json()),
    );

    if (!parsed.success) {
      return timing.response(
        NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Invalid project." },
          { status: 400 },
        ),
      );
    }

    const project = await timing.query("project_create", () =>
      prisma.project.create({
        data: {
          userId: user.id,
          name: parsed.data.name,
          description: parsed.data.description || null,
          sharedContext: parsed.data.sharedContext || null,
        },
      }),
    );

    return timing.response(NextResponse.json({ project }));
  } catch (error) {
    return timing.response(apiErrorResponse(error));
  }
}
