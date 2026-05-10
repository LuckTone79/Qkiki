import "server-only";

import type { ProviderName } from "@/lib/ai/types";
import { PROVIDERS } from "@/lib/ai/provider-catalog";
import { prisma } from "@/lib/prisma";

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function assertProvidersReadyForRun(
  providerNames: ProviderName[],
  userId?: string,
) {
  const uniqueNames = Array.from(new Set(providerNames));
  if (!uniqueNames.length) {
    return null;
  }

  const configs = await prisma.adminProviderConfig.findMany({
    where: { providerName: { in: uniqueNames } },
  });

  for (const providerName of uniqueNames) {
    let config = configs.find((item) => item.providerName === providerName);
    const catalog = PROVIDERS.find((item) => item.name === providerName);
    const hasEnvKey = Boolean(catalog && process.env[catalog.envKey]?.trim());
    const hasStoredKey = Boolean(config?.apiKeyCiphertext);
    const hasCredential = hasEnvKey || hasStoredKey;

    if (!config && catalog && hasCredential) {
      config = await prisma.adminProviderConfig.create({
        data: {
          providerName,
          defaultModel: catalog.defaultModel,
          isEnabled: true,
          healthStatus: "ready",
        },
      });
    }

    const effectiveEnabled = config ? config.isEnabled : hasCredential;

    if (!effectiveEnabled) {
      return `${providerName} is disabled by administrator.`;
    }

    if (!hasCredential) {
      return `${providerName} API key is not configured by administrator.`;
    }

    if (userId && config?.perUserDailyLimit && config.perUserDailyLimit > 0) {
      const usedToday = await prisma.aiRequest.count({
        where: {
          userId,
          provider: providerName,
          createdAt: { gte: startOfToday() },
        },
      });

      if (usedToday >= config.perUserDailyLimit) {
        return `${providerName} daily request limit has been reached.`;
      }
    }
  }

  return null;
}
