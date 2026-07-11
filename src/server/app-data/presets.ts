import "server-only";

import { prisma } from "@/lib/prisma";
import { buildPresetListQuery } from "@/server/app-data/query-shapes";

export async function listPresetsForUser(userId: string) {
  const presets = await prisma.preset.findMany(buildPresetListQuery(userId));

  return presets.map((preset) => ({
    ...preset,
    createdAt: preset.createdAt.toISOString(),
    updatedAt: preset.updatedAt.toISOString(),
  }));
}

export type PresetListItem = Awaited<
  ReturnType<typeof listPresetsForUser>
>[number];
