import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { presetSchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const parsed = presetSchema.partial().safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid preset." },
        { status: 400 },
      );
    }

    if (parsed.data.workflowJson) {
      JSON.parse(parsed.data.workflowJson);
    }

    const existing = await prisma.preset.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Preset not found." }, { status: 404 });
    }

    const preset = await prisma.preset.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined
          ? { description: parsed.data.description || null }
          : {}),
        ...(parsed.data.workflowJson !== undefined
          ? { workflowJson: parsed.data.workflowJson }
          : {}),
      },
    });

    return NextResponse.json({ preset });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Preset workflow must be valid JSON." },
        { status: 400 },
      );
    }

    return apiErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const existing = await prisma.preset.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Preset not found." }, { status: 404 });
    }

    await prisma.preset.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
