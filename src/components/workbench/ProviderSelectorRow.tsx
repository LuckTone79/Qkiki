"use client";

import { StatusBadge } from "@/components/StatusBadge";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import type { ProviderName } from "@/lib/ai/types";
import { getModelOptionLabel } from "@/lib/ai/model-display";

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
  selectedModels: string[];
  onEnabledChange: (enabled: boolean) => void;
  onSelectedModelsChange: (models: string[]) => void;
};

export function ProviderSelectorRow({
  provider,
  enabled,
  selectedModels,
  onEnabledChange,
  onSelectedModelsChange,
}: ProviderSelectorRowProps) {
  const { language } = useLanguage();
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
      <div className="mt-3 rounded-md border border-stone-200 bg-[#fbfcf8] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-stone-500">
            {language === "ko" ? "선택 모델" : "Selected models"}
          </p>
          <span className="text-[11px] text-stone-400">
            {selectedModels.length
              ? `${selectedModels.length}${language === "ko" ? "개 선택" : " selected"}`
              : language === "ko"
                ? "선택 없음"
                : "None selected"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {provider.models.map((option) => {
            const checked = selectedModels.includes(option);
            const label = getModelOptionLabel(provider.providerName, option);
            return (
              <label
                key={option}
                className={`min-h-9 rounded-md border px-2 py-2 text-xs ${
                  checked
                    ? "border-teal-300 bg-teal-50 text-teal-900"
                    : "border-stone-300 bg-white text-stone-700"
                } ${!isReady ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  <input
                  type="checkbox"
                  checked={checked}
                  disabled={!isReady}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...selectedModels, option]
                      : selectedModels.filter((model) => model !== option);
                    onSelectedModelsChange(next);
                  }}
                  className="mr-1 accent-teal-700"
                />
                {label}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
