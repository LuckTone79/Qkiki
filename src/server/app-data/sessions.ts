import "server-only";

import { prisma } from "@/lib/prisma";
import { ensureWorkflowControlJsonColumn } from "@/lib/workbench-session-schema";
import {
  serializeSessionListItem,
  type SessionListDataItem,
} from "@/server/app-data/serializers";

export async function listSessionsForUser(
  userId: string,
): Promise<SessionListDataItem[]> {
  await ensureWorkflowControlJsonColumn();
  const sessions = await prisma.workbenchSession.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      originalInput: true,
      mode: true,
      createdAt: true,
      updatedAt: true,
      project: { select: { id: true, name: true } },
      _count: { select: { results: true, workflowSteps: true } },
      executionRuns: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          id: true,
          mode: true,
          status: true,
          totalStepsPlanned: true,
          totalStepsDone: true,
          finalResultId: true,
          updatedAt: true,
        },
      },
    },
  });

  return sessions.map(serializeSessionListItem);
}
