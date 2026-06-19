import "server-only";

import { prisma } from "@/lib/prisma";
import {
  serializeProjectListItem,
  type ProjectListDataItem,
} from "@/server/app-data/serializers";

export async function listProjectsForUser(
  userId: string,
): Promise<ProjectListDataItem[]> {
  const projects = await prisma.project.findMany({
    where: { userId },
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

  return projects.map(serializeProjectListItem);
}
