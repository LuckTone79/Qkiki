import type { PrismaClient } from "@prisma/client";

type ProjectSessionRemovalDb = Pick<PrismaClient, "$transaction">;

export async function removeSessionFromProject(input: {
  db: ProjectSessionRemovalDb;
  userId: string;
  projectId: string;
  sessionId: string;
}) {
  return input.db.$transaction(async (transaction) => {
    const updated = await transaction.workbenchSession.updateMany({
      where: {
        id: input.sessionId,
        userId: input.userId,
        projectId: input.projectId,
      },
      data: { projectId: null },
    });

    if (updated.count !== 1) {
      return false;
    }

    await transaction.projectItem.deleteMany({
      where: {
        projectId: input.projectId,
        userId: input.userId,
        sessionId: input.sessionId,
      },
    });

    return true;
  });
}
