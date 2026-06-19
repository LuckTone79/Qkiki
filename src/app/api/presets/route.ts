import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { presetSchema } from "@/lib/validation";
import { listPresetsForUser } from "@/server/app-data/presets";
import { createRouteTiming } from "@/server/perf/route-timing";

export async function GET() {
  const timing = createRouteTiming();

  try {
    const user = await timing.time("auth", () => requireApiUser());
    const presets = await timing.query("preset_list", () =>
      listPresetsForUser(user.id),
    );

    return timing.response(NextResponse.json({ presets }));
  } catch (error) {
    return timing.response(apiErrorResponse(error));
  }
}

export async function POST(request: Request) {
  const timing = createRouteTiming();

  try {
    const user = await timing.time("auth", () => requireApiUser());
    const parsed = presetSchema.safeParse(
      await timing.time("parse_body", () => request.json()),
    );

    if (!parsed.success) {
      return timing.response(
        NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Invalid preset." },
          { status: 400 },
        ),
      );
    }

    JSON.parse(parsed.data.workflowJson);

    const preset = await timing.query("preset_create", () =>
      prisma.preset.create({
        data: {
          userId: user.id,
          name: parsed.data.name,
          description: parsed.data.description || null,
          workflowJson: parsed.data.workflowJson,
        },
      }),
    );

    return timing.response(NextResponse.json({ preset }));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return timing.response(
        NextResponse.json(
          { error: "Preset workflow must be valid JSON." },
          { status: 400 },
        ),
      );
    }

    return timing.response(apiErrorResponse(error));
  }
}
