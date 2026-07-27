"use client";

import { localize, useLanguage } from "@/components/i18n/LanguageProvider";
import { ProviderLogoTile } from "@/components/ui/icons";
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

  const subtitle = isReady
    ? selectedModels.length
      ? `${selectedModels.length}${localize(language, {
          en: " model(s) selected",
          ko: "개 모델 선택",
          ja: "件のモデルを選択",
          es: " modelo(s)",
        })}`
      : localize(language, {
          en: "Tap to enable",
          ko: "탭하여 선택",
          ja: "タップして選択",
          es: "Toca para activar",
        })
    : provider.status === "disabled"
      ? localize(language, {
          en: "Disabled by administrator",
          ko: "관리자가 비활성화함",
          ja: "管理者により無効",
          es: "Desactivado por el administrador",
        })
      : localize(language, {
          en: "Not configured",
          ko: "설정되지 않음",
          ja: "未設定",
          es: "Sin configurar",
        });

  const helpText = isImageVariant
    ? localize(language, {
        en: "Generates images with the image models you select.",
        ko: "선택한 이미지 생성 모델로 이미지를 만듭니다.",
        ja: "選択した画像生成モデルで画像を作成します。",
        es: "Genera imágenes con los modelos de imagen que selecciones.",
      })
    : provider.fallbackProvider
      ? localize(language, {
          en: `Provider errors may continue with the administrator fallback ${fallbackProviderLabel}.`,
          ko: `공급자 오류 시 관리자 지정 대체 공급자 ${fallbackProviderLabel}로 이어질 수 있습니다.`,
          ja: `プロバイダーエラー時は管理者指定のフォールバック ${fallbackProviderLabel} に引き継がれることがあります。`,
          es: `Los errores del proveedor pueden continuar con el proveedor de respaldo del administrador ${fallbackProviderLabel}.`,
        })
      : null;

  return (
    <div
      className={`rounded-2xl border bg-white p-3 transition-colors sm:p-4 xl:p-3 ${
        enabled ? "border-[1.5px] border-stone-950" : "border-stone-200"
      } ${!isReady ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        disabled={!isReady}
        aria-pressed={enabled}
        onClick={() => onEnabledChange(!enabled)}
        className="flex w-full items-start justify-between gap-3 text-left disabled:cursor-not-allowed"
      >
        <span className="flex min-h-10 items-center gap-3">
          <ProviderLogoTile
            provider={provider.providerName}
            className="h-10 w-10 rounded-xl"
            glyphClassName="h-5 w-5"
          />
          <span>
            <span className="block text-sm font-bold text-stone-950">
              {provider.displayName}
            </span>
            <span className="text-xs text-stone-500">{subtitle}</span>
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
            enabled
              ? "bg-stone-950 text-white"
              : "border-[1.5px] border-stone-300 bg-white text-transparent"
          }`}
        >
          ✓
        </span>
      </button>

      {enabled ? (
        <div className="mt-3 border-t border-stone-100 pt-3">
          {helpText ? (
            <p className="mb-2 text-[11px] leading-5 text-stone-500">{helpText}</p>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
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
              const title = guidance
                ? [
                    guidance.recommended ? guidance.recommendedLabel : null,
                    ...guidance.traits,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : undefined;
              return (
                <button
                  key={option}
                  type="button"
                  disabled={!isReady}
                  aria-pressed={checked}
                  title={title}
                  onClick={() => {
                    const next = checked
                      ? selectedModels.filter((model) => model !== option)
                      : [...selectedModels, option];
                    onSelectedModelsChange(next);
                  }}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                    checked
                      ? "bg-stone-950 text-white"
                      : "border border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  {label}
                  {guidance?.recommended ? (
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${
                        checked ? "bg-teal-400" : "bg-teal-600"
                      }`}
                      aria-label={guidance.recommendedLabel}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
