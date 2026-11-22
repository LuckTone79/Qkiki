import type { ModelPricing } from "../credits";
import type { ProviderName } from "./types";

export const PRICING_DOCUMENTS = {
  openai: "https://developers.openai.com/api/docs/pricing.md",
  anthropic: "https://platform.claude.com/docs/en/about-claude/pricing.md",
  google: "https://aistudio.google.com/docs/pricing.md",
  xai: "https://docs.x.ai/developers/models",
} as const;

type Entry = Record<string, unknown>;
export type ObservedModel = {
  id: string;
  name?: string;
  image?: boolean;
  price?: ModelPricing;
  shutdown?: string;
};

const positive = (value: number) => Number.isFinite(value) && value > 0;

function pricing(prompt: number, completion: number): ModelPricing | undefined {
  if (!positive(prompt) || !positive(completion)) return;
  return { promptPerMillion: prompt, completionPerMillion: completion };
}

function dollars(value: string | undefined, suffix = "") {
  const match = value?.trim().match(new RegExp(`^\\$([0-9]+(?:\\.[0-9]+)?)${suffix}$`));
  return match ? Number(match[1]) : NaN;
}

export function parseOfficialTextPrice(
  provider: ProviderName,
  item: ObservedModel,
  document: string,
): ModelPricing | undefined {
  if (provider === "xai") return item.price;
  if (provider === "google") {
    const sections = document.split(/^## /m);
    const section = sections.find((block) => block.split("\n", 1)[0].includes(`id="${item.id}"`));
    const standard = section?.split('{% tab title="Standard" %}')[1]?.split("{% /tab %}")[0];
    if (!standard?.includes("Paid Tier, per 1M tokens in USD")) return;
    const rate = (label: RegExp) => {
      const row = standard.split(/^\s*---\s*$/m).find((block) => label.test(block));
      const lines = row?.trim().split("\n") ?? [];
      const amounts = lines.slice(2).map((line) => line.trim().replace(/^\* /, ""));
      if (amounts.length === 1) {
        return dollars(amounts[0], "(?: \\(text(?: / (?:image|video|audio))*\\))?");
      }
      const calendarBand = /^(\$[\d.]+) (?:through|starting) [A-Z][a-z]+ \d{1,2}, \d{4}\.$/;
      const contextBand = /^(\$[\d.]+), prompts (?:<=|>) \d+k(?: tokens)?$/;
      const textBand = /^(\$[\d.]+) \(text(?: \/ (?:image|video|audio))*\)$/;
      if (amounts.length === 2 && textBand.test(amounts[0]) && /^\$[\d.]+ \(audio\)$/.test(amounts[1])) {
        return dollars(amounts[0].match(textBand)?.[1]);
      }
      for (const band of [calendarBand, contextBand]) {
        if (amounts.length === 2 && amounts.every((line) => band.test(line))) {
          return Math.max(...amounts.map((line) => dollars(line.match(band)?.[1])));
        }
      }
      return NaN;
    };
    return pricing(rate(/^\s*\* Input price(?: \(text, image, video\))?\s*$/m), rate(/^\s*\* Output price(?: \(including thinking tokens\))?\s*$/m));
  }

  const rows = document.split("\n").filter((line) => line.startsWith("|"));
  if (provider === "anthropic") {
    if (!item.name || !document.includes("Base input tokens")) return;
    const rates = rows.map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
      .filter((row) => row[0].toLowerCase() === item.name?.toLowerCase() && row.length === 6)
      .map((row) => pricing(dollars(row[1], " / MTok"), dollars(row[5], " / MTok")));
    return rates.length === 1 ? rates[0] : undefined;
  }

  const standard = document.split("### Standard pricing data")[1]?.split(/^### /m)[0];
  if (!standard?.includes("| Model | Input | Output | Cached input |")) return;
  const matches = standard.split("\n")
    .filter((line) => line.startsWith("|"))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter((row) => row[0] === item.id && row.length === 4);
  if (matches.length === 1) return pricing(dollars(matches[0][1]), dollars(matches[0][2]));
  const tiered = standard.split("\n").map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter((row) => row[0] === item.id && row.length === 11);
  if (tiered.length !== 1 || !standard.includes("Long context input | Long context output")) return;
  const row = tiered[0];
  return pricing(Math.max(dollars(row[1]), dollars(row[6])), Math.max(dollars(row[2]), dollars(row[7])));
}

export function isStableTextModel(provider: ProviderName, id: string) {
  if (/(?:^|[-.])(?:preview|experimental|exp|beta|alpha|latest|image|audio|tts|realtime|embedding|moderation|deprecated|base)(?:[-.]|$)/i.test(id)) {
    return false;
  }
  // Require an app-compatible public family and exclude date-stamped copies.
  if (/-\d{4}(?:-\d{2}-\d{2}|\d{4})?$/.test(id)) return false;
  const families: Record<ProviderName, RegExp> = {
    openai: /^gpt-\d+(?:\.\d+)?(?:-(?:mini|nano|luna|terra|sol|astra|pro))?$/,
    anthropic: /^claude-(?:opus|sonnet|haiku|fable)-\d+(?:-\d+)?$/,
    google: /^gemini-\d+(?:\.\d+)?-(?:flash(?:-lite)?|pro|carbon|argon)$/,
    xai: /^grok-\d+(?:\.\d+)?(?:-(?:fast|non-reasoning|reasoning))?$/,
  };
  return families[provider].test(id);
}

function records(value: unknown): Entry[] {
  if (!Array.isArray(value) || !value.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
    throw new Error("invalid_model_list");
  }
  return value;
}

export async function fetchProviderModels(provider: ProviderName, key: string, request = fetch) {
  const bearer = { Authorization: `Bearer ${key}` };
  const get = async (url: URL | string, headers: Record<string, string>): Promise<Entry> => {
    const response = await request(url, { headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`provider_http_${response.status}`);
    return response.json();
  };
  const collected: ObservedModel[] = [];

  if (provider === "xai") {
    const sources = await Promise.all([
      get("https://api.x.ai/v1/language-models", bearer),
      get("https://api.x.ai/v1/image-generation-models", bearer),
    ]);
    sources.forEach((source, index) => {
      for (const item of records(source.models)) {
        if (typeof item.id !== "string") throw new Error("invalid_model_id");
        collected.push({ id: item.id, image: index === 1, price: pricing(
          Math.max(Number(item.prompt_text_token_price), Number(item.prompt_text_token_price_long_context ?? 0)) / 10_000,
          Math.max(Number(item.completion_text_token_price), Number(item.completion_text_token_price_long_context ?? 0)) / 10_000,
        ) });
      }
    });
  } else {
    const endpoint = {
      openai: new URL("https://api.openai.com/v1/models"),
      anthropic: new URL("https://api.anthropic.com/v1/models?limit=100"),
      google: new URL("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100"),
    }[provider];
    const headers = provider === "anthropic" ? { "x-api-key": key, "anthropic-version": "2023-06-01" }
      : provider === "google" ? { "x-goog-api-key": key } : bearer;
    const cursors = new Set<string>();
    for (;;) {
      const data = await get(endpoint, headers as Record<string, string>);
      for (const item of records(provider === "google" ? data.models : data.data)) {
        const id = provider === "google" ? item.name : item.id;
        if (typeof id !== "string") throw new Error("invalid_model_id");
        if (provider === "google" && (!Array.isArray(item.supportedGenerationMethods) ||
          !item.supportedGenerationMethods.some((method) => method === "generateContent" || method === "predict"))) continue;
        collected.push({
          id: id.replace(/^models\//, ""),
          name: typeof item.display_name === "string" ? item.display_name : undefined,
          image: /(?:^|[-.])(?:image|imagen)(?:[-.]|$)/.test(id) || /^models\/imagen-/.test(id),
          shutdown: typeof item.shutdown_date === "string" ? item.shutdown_date : undefined,
        });
      }
      const cursor = provider === "google" ? data.nextPageToken : provider === "anthropic" && data.has_more ? data.last_id : null;
      if (!cursor && !(provider === "anthropic" && data.has_more)) break;
      if (typeof cursor !== "string" || !cursor || cursors.has(cursor) || cursors.size >= 19) throw new Error("incomplete_model_list");
      cursors.add(cursor);
      endpoint.searchParams.set(provider === "google" ? "pageToken" : "after_id", cursor);
    }
  }
  if (collected.length === 0) throw new Error("empty_model_list");
  return collected.filter((item) => /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(item.id));
}
