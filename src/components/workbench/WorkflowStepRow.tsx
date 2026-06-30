"use client";

import { localize } from "@/lib/i18n";

import { useLanguage } from "@/components/i18n/LanguageProvider";
import {
  WORKFLOW_ACTION_TYPES,
  type ActionType,
  type ProviderName,
  type SourceMode,
} from "@/lib/ai/types";
import { getActionTypeDisplayLabel } from "@/lib/ai/action-display";
import type { ProviderOption } from "@/components/workbench/ProviderSelectorRow";
import { getModelOptionLabel } from "@/lib/ai/model-display";

export type WorkflowStepState = {
  uid: string;
  orderIndex: number;
  actionType: ActionType;
  targetProvider: ProviderName;
  targetModel: string;
  sourceMode: SourceMode;
  sourceResultId?: string | null;
  instructionTemplate?: string | null;
};

type WorkflowStepRowProps = {
  step: WorkflowStepState;
  providers: ProviderOption[];
  resultOptions: { id: string; label: string }[];
  onChange: (step: WorkflowStepState) => void;
  onDelete: () => void;
  /** True when this step falls inside a configured repeat block. */
  insideRepeatBlock?: boolean;
};

const sourceOptions: { value: SourceMode; key: "originalInput" | "previousStep" | "selectedResult" | "allCurrentResults" }[] = [
  { value: "original", key: "originalInput" },
  { value: "previous", key: "previousStep" },
  { value: "selected_result", key: "selectedResult" },
  { value: "all_results", key: "allCurrentResults" },
];

export function WorkflowStepRow({
  step,
  providers,
  resultOptions,
  onChange,
  onDelete,
  insideRepeatBlock = false,
}: WorkflowStepRowProps) {
  const { language, t } = useLanguage();
  const currentProvider = providers.find(
    (provider) => provider.providerName === step.targetProvider,
  );

  // A "generate" step reading the original input regenerates from scratch every
  // iteration, so inside a repeat block it never builds on prior results — the
  // model just restates the same idea. Offer a one-click correction.
  const showBuildupHint =
    insideRepeatBlock &&
    step.actionType === "generate" &&
    step.sourceMode === "original";

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[72px_1fr_1fr_1fr_auto] lg:items-start">
        <div className="text-sm font-semibold text-teal-700">
          {t("step")} {step.orderIndex}
        </div>

        <label className="block">
          <span className="text-xs font-medium text-stone-500">{t("action")}</span>
          <select
            value={step.actionType}
            onChange={(event) =>
              onChange({ ...step, actionType: event.target.value as ActionType })
            }
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2 py-2 text-sm outline-none focus:border-teal-600"
          >
            {WORKFLOW_ACTION_TYPES.map((actionType) => (
              <option key={actionType} value={actionType}>
                {getActionTypeDisplayLabel(actionType, language)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-stone-500">{t("model")}</span>
          <div className="mt-1 flex flex-col gap-1.5">
            <select
              value={step.targetProvider}
              onChange={(event) => {
                const providerName = event.target.value as ProviderName;
                const provider = providers.find(
                  (item) => item.providerName === providerName,
                );
                onChange({
                  ...step,
                  targetProvider: providerName,
                  targetModel: provider?.defaultModel ?? step.targetModel,
                });
              }}
              className="w-full rounded-md border border-stone-300 bg-white px-2 py-2 text-sm outline-none focus:border-teal-600"
            >
              {providers.map((provider) => (
                <option key={provider.providerName} value={provider.providerName}>
                  {provider.shortName}
                </option>
              ))}
            </select>
            <select
              value={step.targetModel}
              onChange={(event) =>
                onChange({ ...step, targetModel: event.target.value })
              }
              className="w-full rounded-md border border-stone-300 bg-white px-2 py-2 text-sm outline-none focus:border-teal-600"
            >
              {(currentProvider?.models ?? [step.targetModel]).map((model) => (
                <option key={model} value={model}>
                  {getModelOptionLabel(step.targetProvider, model)}
                </option>
              ))}
            </select>
          </div>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-stone-500">{t("source")}</span>
          <select
            value={step.sourceMode}
            onChange={(event) =>
              onChange({
                ...step,
                sourceMode: event.target.value as SourceMode,
                sourceResultId:
                  event.target.value === "selected_result"
                    ? step.sourceResultId
                    : null,
              })
            }
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2 py-2 text-sm outline-none focus:border-teal-600"
          >
            {sourceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.key)}
              </option>
            ))}
          </select>
          {step.sourceMode === "selected_result" ? (
            <select
              value={step.sourceResultId ?? ""}
              onChange={(event) =>
                onChange({ ...step, sourceResultId: event.target.value || null })
              }
              className="mt-2 w-full rounded-md border border-stone-300 bg-white px-2 py-2 text-sm outline-none focus:border-teal-600"
            >
              <option value="">{t("chooseResult")}</option>
              {resultOptions.map((result) => (
                <option key={result.id} value={result.id}>
                  {result.label}
                </option>
              ))}
            </select>
          ) : null}
        </label>

        <button
          type="button"
          onClick={onDelete}
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 lg:mt-5 lg:w-auto"
        >
          {t("delete")}
        </button>
      </div>

      <label className="mt-3 block">
        <span className="text-xs font-medium text-stone-500">
          {t("stepInstruction")}
        </span>
        <input
          value={step.instructionTemplate ?? ""}
          onChange={(event) =>
            onChange({ ...step, instructionTemplate: event.target.value })
          }
          className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
          placeholder={t("stepInstructionPlaceholder")}
        />
      </label>

      {showBuildupHint ? (
        <div className="mt-3 flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-amber-800">
            {localize(language, { en: "This step is inside a repeat block but is set to Generate / Original input, so it regenerates the same answer each cycle instead of building on prior results.", ko: "이 단계는 반복 구간 안에 있지만 '생성 / 원본 입력'이라 매 회차 같은 답을 새로 만들고 이전 결과 위에 쌓지 않습니다.", ja: "\u3053\u306E\u30B9\u30C6\u30C3\u30D7\u306F\u7E70\u308A\u8FD4\u3057\u30D6\u30ED\u30C3\u30AF\u5185\u306B\u3042\u308A\u307E\u3059\u304C\u3001\u751F\u6210 / \u5143\u306E\u5165\u529B\u306B\u8A2D\u5B9A\u3055\u308C\u3066\u3044\u308B\u305F\u3081\u3001\u4EE5\u524D\u306E\u7D50\u679C\u306B\u57FA\u3065\u3044\u3066\u69CB\u7BC9\u3059\u308B\u306E\u3067\u306F\u306A\u304F\u3001\u30B5\u30A4\u30AF\u30EB\u3054\u3068\u306B\u540C\u3058\u56DE\u7B54\u304C\u518D\u751F\u6210\u3055\u308C\u307E\u3059\u3002", es: "Este paso est\u00E1 dentro de un bloque de repetici\u00F3n, pero est\u00E1 configurado en Generar/entrada original, por lo que regenera la misma respuesta en cada ciclo en lugar de basarse en resultados anteriores." })}
          </p>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...step,
                actionType: "brainstorm",
                sourceMode: "all_results",
                sourceResultId: null,
              })
            }
            className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
          >
            {localize(language, { en: "Switch to Brainstorm + prior results", ko: "브레인스토밍 + 이전 결과로 바꾸기", ja: "\u30D6\u30EC\u30A4\u30F3\u30B9\u30C8\u30FC\u30DF\u30F3\u30B0 + \u4EE5\u524D\u306E\u7D50\u679C\u306B\u5207\u308A\u66FF\u3048\u308B", es: "Cambiar a Brainstorm + resultados anteriores" })}
          </button>
        </div>
      ) : null}
    </div>
  );
}
