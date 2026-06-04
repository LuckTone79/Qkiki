import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { ensureWorkflowControlJsonColumn } from "@/lib/workbench-session-schema";

export async function GET() {
  try {
    const user = await requireApiUser();
    await ensureWorkflowControlJsonColumn();
    const sessions = await prisma.workbenchSession.findMany({
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
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
