import { NextResponse } from "next/server";
import {
  adminApiErrorResponse,
  getRequestMeta,
  requireApiAdminManager,
} from "@/lib/admin-api-auth";
import { PROVIDERS, isProviderName } from "@/lib/ai/provider-catalog";
import { logAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import { encryptSecret, maskApiKey } from "@/lib/secret-crypto";
import { adminProviderConfigSchema } from "@/lib/validation";

export async function GET() {
  try {
    await requireApiAdminManager();
    const configs = await prisma.adminProviderConfig.findMany();

    const payload = PROVIDERS.map((provider) => {
      const config = configs.find((item) => item.providerName === provider.name);
      const hasEnvKey = Boolean(process.env[provider.envKey]?.trim());
      const hasStoredKey = Boolean(config?.apiKeyCiphertext);
      const hasCredential = hasEnvKey || hasStoredKey;
      const effectiveEnabled = config ? config.isEnabled : hasCredential;
      const configuredModel = config?.defaultModel ?? provider.defaultModel;

      return {
        providerName: provider.name,
        displayName: provider.displayName,
        shortName: provider.shortName,
        models: provider.models,
        defaultModel: provider.models.includes(configuredModel)
          ? configuredModel
          : provider.defaultModel,
        isEnabled: effectiveEnabled,
        fallbackProvider: config?.fallbackProvider ?? null,
        perUserDailyLimit: config?.perUserDailyLimit ?? 100,
        timeoutSeconds: config?.timeoutSeconds ?? 60,
        healthStatus: config?.healthStatus ?? "unknown",
        lastHealthCheckedAt: config?.lastHealthCheckedAt ?? null,
        hasEnvKey,
        hasStoredKey,
        apiKeyMasked: config?.apiKeyMasked ?? null,
        status: !effectiveEnabled
          ? "disabled"
          : hasCredential
            ? "ready"
            : "missing_key",
      };
    });

    return NextResponse.json({ providers: payload });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await requireApiAdminManager();
    const meta = getRequestMeta(request);
    const parsed = adminProviderConfigSchema.safeParse(await request.json());

    if (!parsed.success || !isProviderName(parsed.data.providerName)) {
      return NextResponse.json(
        { error: parsed.error?.issues[0]?.message ?? "Invalid provider config." },
        { status: 400 },
      );
    }

    if (
      parsed.data.fallbackProvider &&
      parsed.data.fallbackProvider === parsed.data.providerName
    ) {
      return NextResponse.json(
        { error: "Fallback provider must be different from the provider being edited." },
        { status: 400 },
      );
    }

    const apiKey = parsed.data.apiKey?.trim();
    const encrypted = apiKey ? encryptSecret(apiKey) : null;
    const fallbackProvider = parsed.data.fallbackProvider ?? null;
    const perUserDailyLimit = parsed.data.perUserDailyLimit ?? 100;
    const timeoutSeconds = parsed.data.timeoutSeconds ?? 60;
    const existing = await prisma.adminProviderConfig.findUnique({
      where: { providerName: parsed.data.providerName },
    });

    const updated = await prisma.adminProviderConfig.upsert({
      where: { providerName: parsed.data.providerName },
      create: {
        providerName: parsed.data.providerName,
        isEnabled: parsed.data.isEnabled,
        defaultModel: parsed.data.defaultModel,
        fallbackProvider,
        perUserDailyLimit,
        timeoutSeconds,
        apiKeyCiphertext: encrypted?.ciphertext ?? null,
        apiKeyIv: encrypted?.iv ?? null,
        apiKeyTag: encrypted?.tag ?? null,
        apiKeyMasked: apiKey ? maskApiKey(apiKey) : null,
        updatedByAdminId: admin.id,
      },
      update: {
        isEnabled: parsed.data.isEnabled,
        defaultModel: parsed.data.defaultModel,
        fallbackProvider,
        perUserDailyLimit,
        timeoutSeconds,
        ...(parsed.data.clearStoredKey
          ? {
              apiKeyCiphertext: null,
              apiKeyIv: null,
              apiKeyTag: null,
              apiKeyMasked: null,
            }
          : {}),
        ...(encrypted
          ? {
              apiKeyCiphertext: encrypted.ciphertext,
              apiKeyIv: encrypted.iv,
              apiKeyTag: encrypted.tag,
              apiKeyMasked: maskApiKey(apiKey || ""),
            }
          : {}),
        updatedByAdminId: admin.id,
      },
    });

    if (existing?.defaultModel !== parsed.data.defaultModel) {
      await logAdminAudit({
        adminUserId: admin.id,
        action: "PROVIDER_MODEL_UPDATE",
        targetType: "provider",
        targetId: updated.providerName,
        detail: {
          from: existing?.defaultModel ?? null,
          to: parsed.data.defaultModel,
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    }

    if (apiKey || parsed.data.clearStoredKey) {
      await logAdminAudit({
        adminUserId: admin.id,
        action: "PROVIDER_KEY_UPDATE",
        targetType: "provider",
        targetId: updated.providerName,
        detail: {
          keyUpdated: Boolean(apiKey),
          keyCleared: Boolean(parsed.data.clearStoredKey),
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    }

    if (
      existing?.isEnabled !== parsed.data.isEnabled ||
      existing?.fallbackProvider !== fallbackProvider ||
      existing?.perUserDailyLimit !== perUserDailyLimit ||
      existing?.timeoutSeconds !== timeoutSeconds
    ) {
      await logAdminAudit({
        adminUserId: admin.id,
        action: "SYSTEM_SETTING_CHANGE",
        targetType: "provider",
        targetId: updated.providerName,
        detail: {
          isEnabled: { from: existing?.isEnabled ?? null, to: parsed.data.isEnabled },
          fallbackProvider: { from: existing?.fallbackProvider ?? null, to: fallbackProvider },
          perUserDailyLimit: {
            from: existing?.perUserDailyLimit ?? null,
            to: perUserDailyLimit,
          },
          timeoutSeconds: {
            from: existing?.timeoutSeconds ?? null,
            to: timeoutSeconds,
          },
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    }

    return NextResponse.json({
      provider: {
        providerName: updated.providerName,
        defaultModel: updated.defaultModel,
        isEnabled: updated.isEnabled,
        fallbackProvider: updated.fallbackProvider,
        perUserDailyLimit: updated.perUserDailyLimit,
        timeoutSeconds: updated.timeoutSeconds,
        healthStatus: updated.healthStatus,
        lastHealthCheckedAt: updated.lastHealthCheckedAt,
        apiKeyMasked: updated.apiKeyMasked,
      },
    });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
