import "server-only";

import { prisma } from "@/lib/prisma";
import {
  serializePresetListItem,
  type PresetListDataItem,
} from "@/server/app-data/serializers";

export async function listPresetsForUser(
  userId: string,
): Promise<PresetListDataItem[]> {
  const presets = await prisma.preset.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });

  return presets.map(serializePresetListItem);
}
