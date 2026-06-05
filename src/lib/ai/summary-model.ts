import type { ProviderName } from "@/lib/ai/types";

export function getParallelComparisonSummaryTarget(): {
  provider: ProviderName;
  model: string;
} {
  return {
    provider: "openai",
    model: "gpt-5.5",
  };
}
