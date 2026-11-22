import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { PROVIDERS, getProviderCatalog, normalizeProviderModel } from "@/lib/ai/provider-catalog";
import type { ProviderName } from "@/lib/ai/types";
import { decryptSecretWithMetadata } from "@/lib/secret-crypto";
import { prisma } from "@/lib/prisma";
import { MODEL_PRICING, type CatalogModelPricing } from "@/lib/credits";

const rate = z.object({ promptPerMillion: z.number().positive(), completionPerMillion: z.number().positive() });
const imageRate = z.object({
  imageProfile: z.enum(["openai_square", "gemini_1k", "xai_1k", "imagen_single"]),
  perImageUsd: z.number().positive(),
  promptPerMillion: z.number().nonnegative(),
  outputImagePerMillion: z.number().positive().optional(),
  textOutputPerMillion: z.number().positive().optional(),
  reference: z.string(),
});
const entry = z.object({
  id: z.string(),
  firstSeenAt: z.string(),
  image: z.boolean(),
  price: rate.optional(),
  imagePrice: imageRate.optional(),
  publishedAt: z.string().optional(),
  blocked: z.string().optional(),
  misses: z.number(),
});
export const catalogSchema = z.object({
  date: z.string(),
  checkedAt: z.string(),
  keyRevision: z.string(),
  status: z.string(),
  entries: z.array(entry),
  automaticDefault: z.string().optional(),
  imageCatalogVersion: z.number().optional(),
});
export type CatalogSnapshot = z.infer<typeof catalogSchema>;
export const catalogKey = (provider: ProviderName) => `model-catalog:${provider}`;
export function keyRevision(key: string) {
  const secret = process.env.APP_SECRET?.trim();
  if (!secret) throw new Error("APP_SECRET is required for catalog credentials.");
  return createHmac("sha256", secret).update(key).digest("hex");
}

export class ModelUnavailableError extends Error {}

export function parseCatalog(value: string | undefined) {
  if (!value) return;
  const parsed = catalogSchema.safeParse(JSON.parse(value));
  if (!parsed.success) throw new Error("Invalid persisted model catalog");
  return parsed.data;
}

export function publishedModels(snapshot?: CatalogSnapshot) {
  return snapshot?.entries.filter((model) => model.publishedAt && model.price && !model.blocked) ?? [];
}

export function publishedImageModels(snapshot?: CatalogSnapshot) {
  return snapshot?.entries.filter((model) => model.image && model.publishedAt && model.imagePrice && !model.blocked) ?? [];
}

export async function readCatalog(provider: ProviderName) {
  const row = await prisma.adminSystemSetting.findUnique({ where: { settingKey: catalogKey(provider) } });
  return parseCatalog(row?.valueJson);
}

export async function getLiveProviderCatalogs() {
  const [rows, configs] = await Promise.all([
    prisma.adminSystemSetting.findMany({ where: { settingKey: { in: PROVIDERS.map((p) => catalogKey(p.name)) } } }),
    prisma.adminProviderConfig.findMany(),
  ]);
  return PROVIDERS.map((provider) => {
    const config = configs.find((row) => row.providerName === provider.name);
    const snapshot = parseCatalog(rows.find((row) => row.settingKey === catalogKey(provider.name))?.valueJson);
    let models: ReturnType<typeof publishedModels> = [];
    let images: ReturnType<typeof publishedImageModels> = [];
    if (snapshot && config?.isEnabled !== false) {
      try {
        const key = process.env[provider.envKey]?.trim() || (config?.apiKeyCiphertext && config.apiKeyIv && config.apiKeyTag
          ? decryptSecretWithMetadata({ ciphertext: config.apiKeyCiphertext, iv: config.apiKeyIv, tag: config.apiKeyTag }).value
          : null);
        if (key && snapshot.keyRevision === keyRevision(key)) {
          models = publishedModels(snapshot);
          images = publishedImageModels(snapshot);
        }
      } catch {
        // Static models remain available when an administrator credential cannot be read.
      }
    }
    return { provider, config, snapshot, models, images };
  });
}

export function resolveCatalogDefault(
  provider: ProviderName,
  configured: string | null | undefined,
  pinned: boolean,
  snapshot?: CatalogSnapshot,
  published = publishedModels(snapshot),
) {
  const catalog = getProviderCatalog(provider);
  const chosen = normalizeProviderModel(provider, configured ?? catalog.defaultModel);
  const automatic = snapshot?.automaticDefault;
  if (!pinned && chosen === catalog.defaultModel && automatic && published.some((model) => model.id === automatic)) return automatic;
  return catalog.models.includes(chosen) || published.some((model) => model.id === chosen) ? chosen : catalog.defaultModel;
}

export async function getCatalogPrices(targets: ReadonlyArray<{ provider: string; model: string }>, mode?: "image" | "text") {
  const prices: Record<string, CatalogModelPricing> = {};
  const catalogs = await getLiveProviderCatalogs();
  for (const target of targets) {
    const catalog = catalogs.find(({ provider }) => provider.name === target.provider);
    if (!catalog) throw new ModelUnavailableError("Unsupported AI provider.");
    const { provider, models, images } = catalog;
    const model = normalizeProviderModel(provider.name, target.model);
    const imagePrice = images.find((item) => item.id === model)?.imagePrice;
    const external = imagePrice ?? models.find((item) => item.id === model)?.price;
    const isImage = Boolean(imagePrice || provider.imageModels.includes(model));
    if (mode === "image" && !isImage || mode === "text" && isImage) {
      throw new ModelUnavailableError(mode === "image"
        ? "Select a currently available image generation model."
        : "Select a text model for this workflow.");
    }
    if (external) {
      prices[`${provider.name}:${model}`] = external;
      prices[`${provider.name}:${target.model}`] = external;
    } else if (!provider.models.includes(model) && !provider.imageModels.includes(model) &&
      !Object.hasOwn(MODEL_PRICING, `${provider.name}:${model}`)) {
      throw new ModelUnavailableError("This model is unavailable. Choose an available model and request a new estimate.");
    }
  }
  return prices;
}
