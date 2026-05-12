import { NextResponse } from "next/server";
import {
  PROVIDERS,
  normalizeProviderModel,
} from "@/lib/ai/provider-catalog";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireApiUser();

    const configs = await prisma.adminProviderConfig.findMany();

    const payload = PROVIDERS.map((provider) => {
      const config = configs.find((item) => item.providerName === provider.name);
      const hasEnvKey = Boolean(process.env[provider.envKey]?.trim());
      const hasStoredKey = Boolean(config?.apiKeyCiphertext);
      const hasCredential = hasEnvKey || hasStoredKey;
      const isEnabled = config ? config.isEnabled : hasCredential;
      const configuredModel = normalizeProviderModel(
        provider.name,
        config?.defaultModel ?? provider.defaultModel,
      );
      const defaultModel = provider.models.includes(configuredModel)
        ? configuredModel
        : provider.defaultModel;

      return {
        providerName: provider.name,
        displayName: provider.displayName,
        shortName: provider.shortName,
        models: provider.models,
        defaultModel,
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
