import type { ActionType, ProviderName } from "@/lib/ai/types";

const WEB_SEARCH_PROMPT_MARKERS = [
  "Freshness and web research rules:",
  "use web search",
  "web-grounded",
];

export function shouldEnableProviderWebSearch(input: {
  requestType: ActionType | "rerun";
  prompt: string;
}) {
  // Primary env var is YAPP_WEB_SEARCH_ENABLED; the legacy QKIKI_ name is
  // still honored so existing deploy configs keep working during the rebrand.
  const webSearchFlag =
    process.env.YAPP_WEB_SEARCH_ENABLED ?? process.env.QKIKI_WEB_SEARCH_ENABLED;
  if (webSearchFlag === "false") {
    return false;
  }

  if (input.requestType === "fact_check" || input.requestType === "consistency_review") {
    return true;
  }

  return WEB_SEARCH_PROMPT_MARKERS.some((marker) =>
    input.prompt.toLowerCase().includes(marker.toLowerCase()),
  );
}

export function buildProviderWebSearchTools(provider: ProviderName) {
  if (provider === "openai") {
    return [{ type: "web_search", search_context_size: "low" }];
  }

  if (provider === "anthropic") {
    return [{ type: "web_search_20260209", name: "web_search" }];
  }

  if (provider === "google") {
    return [{ google_search: {} }];
  }

  return [{ type: "web_search" }];
}
