import { PresetsClient } from "@/components/presets/PresetsClient";
import { requireUser } from "@/lib/auth";
import { listPresetsForUser } from "@/server/app-data/presets";

export default async function PresetsPage() {
  const user = await requireUser();
  const presets = await listPresetsForUser(user.id);

  return <PresetsClient initialPresets={presets} initialLoaded />;
}
