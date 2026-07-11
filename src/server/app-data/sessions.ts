import "server-only";

import { prisma } from "@/lib/prisma";
import { ensureWorkflowControlJsonColumn } from "@/lib/workbench-session-schema";
import { buildSessionListQuery } from "@/server/app-data/query-shapes";

export async function listSessionsForUser(userId: string) {
  await ensureWorkflowControlJsonColumn();
  const sessions = await prisma.workbenchSession.findMany(
    buildSessionListQuery(userId),
  );

  return sessions.map((session) => ({
    ...session,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    executionRuns: session.executionRuns.map((run) => ({
      ...run,
      updatedAt: run.updatedAt.toISOString(),
    })),
  }));
}

export type SessionListItem = Awaited<
  ReturnType<typeof listSessionsForUser>
>[number];
