import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { presetSchema } from "@/lib/validation";

export async function GET() {
  try {
    const user = await requireApiUser();
    const presets = await prisma.preset.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ presets });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const parsed = presetSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid preset." },
        { status: 400 },
      );
    }

    JSON.parse(parsed.data.workflowJson);

    const preset = await prisma.preset.create({
      data: {
        userId: user.id,
        name: parsed.data.name,
        description: parsed.data.description || null,
        workflowJson: parsed.data.workflowJson,
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
