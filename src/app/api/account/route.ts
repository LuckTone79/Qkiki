import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  try {
    const user = await requireApiUser();
    const body = (await request.json()) as { name?: string };
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { name: body.name?.slice(0, 80) || null },
      select: { id: true, email: true, name: true },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
