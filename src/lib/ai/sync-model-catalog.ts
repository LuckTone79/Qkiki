import "server-only";
import { Prisma } from "@prisma/client";
import { PROVIDERS } from "@/lib/ai/provider-catalog";
import { getApiKeyForProvider } from "@/lib/ai/providers";
import { catalogKey, keyRevision, parseCatalog, publishedModels, type CatalogSnapshot } from "@/lib/ai/live-model-catalog";
import { fetchProviderModels, isStableTextModel, parseOfficialTextPrice, PRICING_DOCUMENTS } from "@/lib/ai/model-discovery";
import { prisma } from "@/lib/prisma";
import { MODEL_PRICING } from "@/lib/credits";

type Metadata = { family?: string; release_date?: string; name?: string; status?: string; limit?: { context?: number; input?: number }; modalities?: { input?: string[]; output?: string[] } };
type MetadataIndex = Record<string, { models?: Record<string, Metadata> }>;

async function publicDocument(url: string) {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(9000) });
  if (!response.ok) throw new Error("public_source_unavailable");
  return response;
}

export function catalogDate(now: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}

export async function syncModelCatalog(now = new Date()) {
  const date = catalogDate(now);
  const checkedAt = now.toISOString();
  let metadataRequest: Promise<MetadataIndex> | undefined;
  const metadata = () => metadataRequest ??= publicDocument("https://models.dev/api.json")
    .then((response) => response.json());
  const results = await Promise.allSettled(PROVIDERS.map(async (provider) => {
    const settingKey = catalogKey(provider.name);
    const row = await prisma.adminSystemSetting.findUnique({ where: { settingKey } });
    const previous = parseCatalog(row?.valueJson);
    if (previous && previous.date >= date) return { provider: provider.name, status: "already_checked" };
    const [key, config] = await Promise.all([
      getApiKeyForProvider(provider.name),
      prisma.adminProviderConfig.findUnique({ where: { providerName: provider.name } }),
    ]);
    const revision = key ? keyRevision(key) : "";
    const snapshot: CatalogSnapshot = {
      date, checkedAt, keyRevision: revision, status: config?.isEnabled === false ? "disabled" : "missing_key",
      entries: previous?.entries ?? [], automaticDefault: previous?.automaticDefault,
    };
    if (key && config?.isEnabled !== false) {
      const [observed, priceDoc, index] = await Promise.all([
        fetchProviderModels(provider.name, key),
        provider.name === "xai" ? "" : publicDocument(PRICING_DOCUMENTS[provider.name]).then((response) => response.text()),
        metadata(),
      ]);
      const models = index[provider.name]?.models;
      if (!models || Object.keys(models).length === 0) throw new Error("model_metadata_unavailable");
      const known = new Map(snapshot.entries.map((entry) => [entry.id, entry]));
      const seen = new Set<string>();
      for (const item of observed) {
        if (provider.models.includes(item.id) || provider.imageModels.includes(item.id) ||
            Object.hasOwn(MODEL_PRICING, `${provider.name}:${item.id}`) || seen.has(item.id)) continue;
        seen.add(item.id);
        const prior = known.get(item.id);
        const meta = models[item.id];
        const image = item.image === true || meta?.modalities?.output?.includes("image") === true;
        const compatible = !image && isStableTextModel(provider.name, item.id) &&
          meta?.modalities?.input?.includes("text") && meta.modalities.output?.join(",") === "text" &&
          (meta.limit?.input ?? meta.limit?.context ?? 0) >= 32_000 &&
          Boolean(meta.release_date && meta.release_date <= date) &&
          !["alpha", "beta", "deprecated"].includes(meta.status ?? "");
        const price = compatible ? parseOfficialTextPrice(provider.name, { ...item, name: meta?.name ?? item.name }, priceDoc) : undefined;
        const shutdown = Boolean(item.shutdown && Number.isFinite(Date.parse(item.shutdown)) && Date.parse(item.shutdown) <= +now);
        const repriced = prior?.price && price && (
          prior.price.promptPerMillion !== price.promptPerMillion || prior.price.completionPerMillion !== price.completionPerMillion
        );
        const blocked = shutdown ? "retired" : image ? "image_review" : !compatible ? "compatibility_review" : !price ? "pricing_review" : repriced ? "price_changed" : undefined;
        known.set(item.id, {
          id: item.id, image, firstSeenAt: prior?.firstSeenAt ?? checkedAt,
          misses: 0, price: prior?.price ?? price, publishedAt: prior?.publishedAt ?? (blocked ? undefined : checkedAt), blocked,
        });
      }
      snapshot.status = "checked";
      snapshot.entries = [...known.values()].map((entry) => {
        if (seen.has(entry.id)) return entry;
        const misses = entry.misses + 1;
        return { ...entry, misses, blocked: misses >= 3 || previous?.keyRevision !== revision ? "not_available" : entry.blocked };
      });
      if (!config?.updatedByAdminId && (!config || config.defaultModel === provider.defaultModel) &&
          previous?.keyRevision === revision) {
        const baseline = provider.defaultModel;
        const anchor = snapshot.automaticDefault ?? baseline;
        const current = known.get(anchor)?.price ?? MODEL_PRICING[`${provider.name}:${anchor}`];
        const family = models[anchor]?.family ?? models[baseline]?.family;
        const next = publishedModels(snapshot).filter((entry) =>
          family && models[entry.id]?.family === family &&
          models[entry.id]?.release_date && (models[entry.id].release_date ?? "") > (models[anchor]?.release_date ?? "9999") &&
          entry.publishedAt && +now - Date.parse(entry.publishedAt) >= 86_400_000 &&
          current && entry.price && entry.price.promptPerMillion <= current.promptPerMillion &&
          entry.price.completionPerMillion <= current.completionPerMillion
        ).sort((a, b) => (models[b.id].release_date ?? "").localeCompare(models[a.id].release_date ?? ""));
        if (next.length > 0 && models[next[0].id].release_date !== models[next[1]?.id]?.release_date) {
          const candidate = next[0];
          const runs = await prisma.aiRequest.findMany({
            where: { provider: provider.name, model: candidate.id, status: "completed",
              createdAt: { gte: new Date(candidate.publishedAt!) }, outputTokens: { gt: 0 } },
            distinct: ["messageId"], take: 3, select: { id: true },
          });
          const failure = await prisma.aiRequest.findFirst({
            where: { provider: provider.name, model: candidate.id, status: "failed",
              createdAt: { gte: new Date(candidate.publishedAt!) } }, select: { id: true },
          });
          if (runs.length >= 3 && !failure) snapshot.automaticDefault = candidate.id;
        }
      }
    }
    const valueJson = JSON.stringify(snapshot);
    if (row) {
      const updated = await prisma.adminSystemSetting.updateMany({ where: { id: row.id, valueJson: row.valueJson }, data: { valueJson } });
      if (!updated.count) return { provider: provider.name, status: "concurrent_update" };
    } else {
      try {
        await prisma.adminSystemSetting.create({ data: { settingKey, valueJson } });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
        return { provider: provider.name, status: "concurrent_update" };
      }
    }
    return { provider: provider.name, status: snapshot.status, observed: snapshot.entries.length, published: publishedModels(snapshot).length };
  }));
  return results.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    const message = result.reason instanceof Error ? result.reason.message : "";
    const code = /^(?:provider_http_\d{3}|public_source_unavailable|model_metadata_unavailable|invalid_model_\w+|empty_model_list|incomplete_model_list)$/.test(message)
      ? message : "sync_failed";
    return { provider: PROVIDERS[index].name, status: "failed", code };
  });
}
