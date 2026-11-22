import type { ObservedModel } from "./model-discovery";
import type { ProviderName } from "./types";

export const RETIREMENT_DOCUMENTS = {
  openai: "https://developers.openai.com/api/docs/deprecations.md",
  anthropic: "https://platform.claude.com/docs/en/about-claude/model-deprecations.md",
  google: "https://aistudio.google.com/docs/deprecations.md",
  xai: "https://docs.x.ai/developers/release-notes.md",
};

const modelIds = (value: string) => [...value.matchAll(/`([a-z][a-z0-9._-]+)`/g)].map((match) => match[1]);

function reached(date: string | undefined, now: Date) {
  if (!date) return false;
  const clean = date.replaceAll("*", "").trim();
  if (!/^(?:[A-Z][a-z]+ \d{1,2}, \d{4}|\d{4}-\d{2}-\d{2}(?:T\S+)?)$/.test(clean)) return false;
  return Date.parse(clean.includes("T") ? clean : `${clean} UTC`) <= +now;
}

export function officialRetirements(provider: ProviderName, doc: string, observed: ObservedModel[], now: Date) {
  const retired = new Set<string>();
  const available = new Set(observed.flatMap(({ id, aliases = [] }) => [id, ...aliases]));
  for (const item of observed) {
    if (reached(item.shutdown, now) || item.retired) retired.add(item.id);
  }
  if (provider === "openai") {
    const tables = doc.split(/^## (?:Upcoming|Past) deprecations\s*$/m).slice(1);
    for (const table of tables) {
      for (const line of table.split(/^## /m)[0].split("\n")) {
        const [, date, models] = line.split("|");
        if (models && reached(date, now)) modelIds(models).forEach((model) => retired.add(model));
      }
    }
  }
  if (provider === "anthropic") {
    const table = doc.split(/^## Model status\s*$/m)[1]?.split(/^## /m)[0] ?? "";
    for (const line of table.split("\n")) {
      const [, id, state] = line.split("|").map((cell) => cell.trim());
      if (id?.startsWith("claude-") && state === "Retired") {
        retired.add(id);
        const alias = id.replace(/-\d{8}$/, "");
        // A later active version of the same alias can still appear in the official API.
        if (!available.has(alias) && !observed.some((model) => model.id.startsWith(alias + "-") && model.id !== id)) {
          retired.add(alias);
        }
      }
    }
    const history = doc.split(/^## Deprecation history\s*$/m)[1]?.split(/^## /m)[0] ?? "";
    for (const section of history.split(/^### /m)) {
      if (section.includes("tentative") || section.includes("no sooner than")) continue;
      const line = section.split("\n").find((row) => row.startsWith("|") && reached(row.split("|")[1], now));
      const affected = line?.split("|")[2];
      if (affected) modelIds(affected).forEach((id) => retired.add(id));
      const aliasLine = section.match(/^This retirement includes (.+)$/m)?.[1];
      if (affected && aliasLine) modelIds(aliasLine).forEach((id) => retired.add(id));
    }
  }
  if (provider === "google") {
    for (const table of doc.matchAll(/\{% table %\}([\s\S]+?)\{% \/table %\}/g)) {
      if (!table[1].includes("* Shutdown date")) continue;
      for (const block of table[1].split(/^\s*---\s*$/m).slice(1)) {
        const [model, , date, replacement = ""] = block.trim().split("\n").map((line) => line.trim().replace(/^\*\s*/, ""));
        const id = modelIds(model ?? "")[0];
        if (!id) continue;
        const redirectsNow = /automatically routes API requests to/i.test(replacement);
        const redirectsOnDate = /API requests .+ will automatically route to/i.test(replacement) && reached(date, now);
        // Google's published dates are earliest possible shutdowns. Confirm absence
        // in a successful API response unless Google explicitly confirms a redirect.
        if (redirectsNow || redirectsOnDate || (reached(date, now) && !available.has(id))) retired.add(id);
      }
    }
  }
  if (provider === "xai") {
    for (const section of doc.split(/^### /m).slice(1)) {
      const heading = section.split("\n", 1)[0];
      const id = heading.match(/^(grok-[a-z0-9._-]+) (?:retired|end of life)$/i)?.[1];
      if (!id) continue;
      retired.add(id);
      const redirected = section.match(/^Requests to (.+?) are now served by /m)?.[1];
      if (redirected) modelIds(redirected).forEach((model) => retired.add(model));
    }
  }
  return retired;
}

export function missedModels(
  models: { models: string[]; imageModels: string[] },
  observed: ObservedModel[],
  previous: Record<string, number>,
  newDay: boolean,
) {
  const aliases = new Set(observed.flatMap(({ id, aliases = [] }) => [id, ...aliases]));
  const result: Record<string, number> = {};
  for (const id of [...models.models, ...models.imageModels]) {
    if (aliases.has(id)) continue;
    const hasPeer = observed.some((entry) => Boolean(entry.image) === models.imageModels.includes(id));
    if (!hasPeer && !previous[id]) continue;
    result[id] = (previous[id] ?? 0) + Number(newDay && hasPeer);
  }
  return result;
}
