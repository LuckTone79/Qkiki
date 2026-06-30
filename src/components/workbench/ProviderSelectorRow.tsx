"use client";

import { localize } from "@/lib/i18n";

import { StatusBadge } from "@/components/StatusBadge";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { getModelOptionLabel } from "@/lib/ai/model-display";
import type { ProviderName } from "@/lib/ai/types";
import { getModelGuidance } from "@/lib/workbench-model-guidance";

export type ProviderOption = {
  providerName: ProviderName;
  displayName: string;
  shortName: string;
  models: string[];
  imageModels: string[];
  defaultModel: string;
  fallbackProvider: ProviderName | null;
  isEnabled: boolean;
  status: string;
};

type ProviderSelectorRowProps = {
  provider: ProviderOption;
  enabled: boolean;
  selectedModels: string[];
  onEnabledChange: (enabled: boolean) => void;
  onSelectedModelsChange: (models: string[]) => void;
  /**
   * Models to offer for selection. Defaults to the provider's text models; the
   * image-generation panel passes the provider's image models instead.
   */
  availableModels?: string[];
  variant?: "text" | "image";
};

export function ProviderSelectorRow({
  provider,
  enabled,
  selectedModels,
  onEnabledChange,
  onSelectedModelsChange,
  availableModels,
  variant = "text",
}: ProviderSelectorRowProps) {
  const { language } = useLanguage();
  const models = availableModels ?? provider.models;
  const isImageVariant = variant === "image";
  const isReady = provider.status === "ready";
  const fallbackProviderLabel = provider.fallbackProvider
    ? provider.fallbackProvider.toUpperCase()
    : "";
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
      <div className="mt-3 rounded-md border border-stone-200 bg-[#f7f6f3] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-stone-500">
            {localize(language, { en: "Selected models", ko: "선택 모델", ja: "\u9078\u629E\u3055\u308C\u305F\u30E2\u30C7\u30EB", es: "Modelos seleccionados" })}
          </p>
          <span className="text-[11px] text-stone-400">
            {selectedModels.length
              ? `${selectedModels.length}${localize(language, { en: " selected", ko: "개 선택", ja: "\u9078\u629E\u3055\u308C\u305F", es: "seleccionado" })}`
              : localize(language, { en: "None selected", ko: "선택 없음", ja: "\u4F55\u3082\u9078\u629E\u3055\u308C\u3066\u3044\u307E\u305B\u3093", es: "Ninguno seleccionado" })}
          </span>
        </div>
        <p className="mb-2 text-[11px] leading-5 text-stone-500">
          {isImageVariant
            ? localize(language, { en: "Generates images with the image models you select.", ko: "선택한 이미지 생성 모델로 이미지를 만듭니다.", ja: "\u9078\u629E\u3057\u305F\u753B\u50CF\u30E2\u30C7\u30EB\u3092\u4F7F\u7528\u3057\u3066\u753B\u50CF\u3092\u751F\u6210\u3057\u307E\u3059\u3002", es: "Genera im\u00E1genes con los modelos de imagen que selecciones." })
            : provider.fallbackProvider
              ? localize(language, { en: `Provider errors may continue with the administrator fallback ${fallbackProviderLabel}.`, ko: `공급자 오류 시 관리자 지정 대체 공급자 ${fallbackProviderLabel}로 이어질 수 있습니다.`, ja: `\u30D7\u30ED\u30D0\u30A4\u30C0\u30FC\u306E\u30A8\u30E9\u30FC\u306F\u7BA1\u7406\u8005\u306E\u30D5\u30A9\u30FC\u30EB\u30D0\u30C3\u30AF\u3067\u3082\u7D99\u7D9A\u3059\u308B\u53EF\u80FD\u6027\u304C\u3042\u308A\u307E\u3059${fallbackProviderLabel}.`, es: `Los errores del proveedor pueden continuar con el respaldo del administrador${fallbackProviderLabel}.` })
              : localize(language, { en: "Runs with the exact model you selected.", ko: "선택한 모델 그대로 실행합니다.", ja: "\u9078\u629E\u3057\u305F\u6B63\u78BA\u306A\u30E2\u30C7\u30EB\u3067\u5B9F\u884C\u3055\u308C\u307E\u3059\u3002", es: "Funciona con el modelo exacto que seleccionaste." })}
        </p>
        <div className="flex flex-wrap gap-2">
          {models.map((option) => {
            const checked = selectedModels.includes(option);
            const label = getModelOptionLabel(provider.providerName, option);
            const guidance = isImageVariant
              ? null
              : getModelGuidance(
                  provider.providerName,
                  option,
                  provider.defaultModel,
                  language,
                );
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
                <span>{label}</span>
                {guidance ? (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {guidance.recommended ? (
                      <span className="rounded-full border border-teal-200 bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold text-teal-800">
                        {guidance.recommendedLabel}
                      </span>
                    ) : null}
                    {guidance.traits.map((trait) => (
                      <span
                        key={`${option}-${trait}`}
                        className="rounded-full border border-stone-200 bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600"
                      >
                        {trait}
                      </span>
                    ))}
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
