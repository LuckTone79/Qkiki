"use client";

import { StatusBadge } from "@/components/StatusBadge";
import type { ProviderName } from "@/lib/ai/types";

export type ProviderOption = {
  providerName: ProviderName;
  displayName: string;
  shortName: string;
  models: string[];
  defaultModel: string;
  isEnabled: boolean;
  status: string;
};

type ProviderSelectorRowProps = {
  provider: ProviderOption;
  enabled: boolean;
  model: string;
  onEnabledChange: (enabled: boolean) => void;
  onModelChange: (model: string) => void;
};

export function ProviderSelectorRow({
  provider,
  enabled,
  model,
  onEnabledChange,
  onModelChange,
}: ProviderSelectorRowProps) {
  const isReady = provider.status === "ready";
  const statusMessage =
    isReady
      ? "Configured by administrator"
      : provider.status === "disabled"
        ? "Disabled by administrator"
        : "Missing administrator key";

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3 sm:p-4 xl:p-3">
      <div className="flex items-start justify-between gap-3">
        <label className="flex min-h-10 items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            disabled={!isReady}
            onChange={(event) => onEnabledChange(event.target.checked)}
            className="h-4 w-4 accent-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <span>
            <span className="block text-sm font-semibold text-stone-950">
              {provider.displayName}
            </span>
            <span className="text-xs text-stone-500">{statusMessage}</span>
          </span>
        </label>
        <StatusBadge status={provider.status} />
      </div>
      <select
        value={model}
        disabled={!isReady}
        onChange={(event) => onModelChange(event.target.value)}
        className="mt-3 min-h-10 w-full rounded-md border border-stone-300 bg-white px-2 py-2 text-sm outline-none focus:border-teal-600 disabled:cursor-not-allowed disabled:bg-stone-100"
      >
        {provider.models.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
