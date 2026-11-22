import { NextResponse } from "next/server";
import { getLiveProviderCatalogs, resolveCatalogDefault } from "@/lib/ai/live-model-catalog";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";

export async function GET() {
  try {
    await requireApiUser();

    const catalogs = await getLiveProviderCatalogs();
    const payload = catalogs.map(({ provider, config, snapshot, models, images }) => {
      const hasEnvKey = Boolean(process.env[provider.envKey]?.trim());
      const hasStoredKey = Boolean(config?.apiKeyCiphertext);
      const hasCredential = hasEnvKey || hasStoredKey;
      const isEnabled = config ? config.isEnabled : hasCredential;
      const defaultModel = resolveCatalogDefault(provider.name, config?.defaultModel, Boolean(config?.updatedByAdminId), snapshot, models);

      return {
        providerName: provider.name,
        displayName: provider.displayName,
        shortName: provider.shortName,
        models: [...models.map((model) => model.id), ...provider.models],
        modelPrices: Object.fromEntries([
          ...models.map((model) => [`${provider.name}:${model.id}`, model.price]),
          ...images.map((model) => [`${provider.name}:${model.id}`, model.imagePrice]),
        ]),
        imageModels: [...images.map((model) => model.id), ...provider.imageModels],
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
