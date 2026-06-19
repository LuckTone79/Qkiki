import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { ensureWorkflowControlJsonColumn } from "@/lib/workbench-session-schema";
import { createRouteTiming } from "@/server/perf/route-timing";

export async function GET() {
  const timing = createRouteTiming();

  try {
    const user = await timing.time("auth", () => requireApiUser());
    await timing.time("schema", () => ensureWorkflowControlJsonColumn());
    const sessions = await timing.query("session_list", () =>
      prisma.workbenchSession.findMany({
        where: { userId: user.id },
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
      }),
    );

    return timing.response(NextResponse.json({ sessions }));
  } catch (error) {
    return timing.response(apiErrorResponse(error));
  }
}
