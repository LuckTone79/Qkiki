import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { ensureResultExecutionRunIdColumn } from "@/lib/workbench-run-schema";
import { ensureWorkflowControlJsonColumn } from "@/lib/workbench-session-schema";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    await ensureResultExecutionRunIdColumn();
    const result = await prisma.result.findFirst({
      where: { id, session: { userId: user.id } },
    });

    if (!result) {
      return NextResponse.json({ error: "Result not found." }, { status: 404 });
    }

    await ensureWorkflowControlJsonColumn();
    await prisma.workbenchSession.update({
      where: { id: result.sessionId },
      data: { finalResultId: result.id },
    });

    return NextResponse.json({ ok: true, finalResultId: result.id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
