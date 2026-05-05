import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireApiUser();
    const sessions = await prisma.workbenchSession.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        project: { select: { id: true, name: true } },
        _count: { select: { results: true, workflowSteps: true } },
      },
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
