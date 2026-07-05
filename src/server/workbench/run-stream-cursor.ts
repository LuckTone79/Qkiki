import "server-only";

import { prisma } from "@/lib/prisma";
import { buildRunStreamCursor } from "@/server/workbench/run-stream-polling";

type RunStreamCursorRow = {
  status: string;
  runUpdatedAt: Date;
  stepUpdatedAt: Date | null;
  stepCount: number;
};

export async function getRunStreamCursor(input: {
  executionRunId: string;
  userId: string;
}) {
  const rows = await prisma.$queryRaw<RunStreamCursorRow[]>`
    SELECT
      run.status,
      run."updatedAt" AS "runUpdatedAt",
      MAX(step."updatedAt") AS "stepUpdatedAt",
      COUNT(step.id)::int AS "stepCount"
    FROM "ExecutionRun" run
    LEFT JOIN "ExecutionRunStep" step
      ON step."executionRunId" = run.id
    WHERE run.id = ${input.executionRunId}
      AND run."userId" = ${input.userId}
    GROUP BY run.id, run.status, run."updatedAt"
  `;
  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    status: row.status,
    value: buildRunStreamCursor(row),
  };
}
