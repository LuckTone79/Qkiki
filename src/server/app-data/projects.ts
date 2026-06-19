import "server-only";

import { prisma } from "@/lib/prisma";
import { buildProjectListQuery } from "@/server/app-data/query-shapes";

export async function listProjectsForUser(userId: string) {
  const projects = await prisma.project.findMany(buildProjectListQuery(userId));

  return projects.map((project) => ({
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    sessions: project.sessions.map((session) => ({
      ...session,
      updatedAt: session.updatedAt.toISOString(),
    })),
  }));
}

export type ProjectListItem = Awaited<
  ReturnType<typeof listProjectsForUser>
>[number];
