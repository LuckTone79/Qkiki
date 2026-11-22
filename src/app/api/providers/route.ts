import { NextResponse } from "next/server";
import { getLiveProviderCatalogs, resolveCatalogDefault, unavailableModel } from "@/lib/ai/live-model-catalog";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";

export async function GET() {
  try {
    await requireApiUser();

    const catalogs = await getLiveProviderCatalogs();
    const payload = catalogs.map(({ provider, config, snapshot, models, images, textModels, imageModels }) => {
      const hasEnvKey = Boolean(process.env[provider.envKey]?.trim());
      const hasStoredKey = Boolean(config?.apiKeyCiphertext);
      const hasCredential = hasEnvKey || hasStoredKey;
      const isEnabled = config ? config.isEnabled : hasCredential;
      const defaultModel = resolveCatalogDefault(provider.name, config?.defaultModel, Boolean(config?.updatedByAdminId), snapshot, models);

      return {
        providerName: provider.name,
        displayName: provider.displayName,
        shortName: provider.shortName,
        models: textModels,
        modelPrices: Object.fromEntries([
          ...models.map((model) => [`${provider.name}:${model.id}`, model.price]),
          ...images.map((model) => [`${provider.name}:${model.id}`, model.imagePrice]),
        ]),
        imageModels,
        unavailableModels: [...new Set([...(snapshot?.retiredModels ?? []),
          ...Object.keys(snapshot?.catalogMisses ?? {}).filter((id) => unavailableModel(snapshot, id))])],
        defaultModel,
        fallbackProvider: config?.fallbackProvider ?? null,
        isEnabled,
        status: !isEnabled
          ? "disabled"
          : hasCredential
            ? "ready"
            : "missing_key",
      };
    });

    return NextResponse.json({ providers: payload });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
