"use client";

import {
  localize,
  useLanguage,
  type AppLanguage,
} from "@/components/i18n/LanguageProvider";
import type { ActionType, ProviderName, SourceMode } from "@/lib/ai/types";
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

const actionOptions: ({ value: ActionType } & Record<AppLanguage, string>)[] = [
  { value: "generate", en: "Generate", ko: "\uc0dd\uc131", ja: "\u751f\u6210", es: "Generar" },
  {
    value: "brainstorm",
    en: "Brainstorm",
    ko: "\ube0c\ub808\uc778\uc2a4\ud1a0\ubc0d",
    ja: "\u30d6\u30ec\u30a4\u30f3\u30b9\u30c8\u30fc\u30df\u30f3\u30b0",
    es: "Lluvia de ideas",
  },
  { value: "critique", en: "Critique", ko: "\ube44\ud310", ja: "\u6279\u8a55", es: "Cr\u00edtica" },
  {
    value: "fact_check",
    en: "Fact-check style review",
    ko: "\ud329\ud2b8\uccb4\ud06c\uc2dd \uac80\ud1a0",
    ja: "\u30d5\u30a1\u30af\u30c8\u30c1\u30a7\u30c3\u30af\u5f62\u5f0f\u306e\u30ec\u30d3\u30e5\u30fc",
    es: "Revisi\u00f3n tipo verificaci\u00f3n",
  },
  { value: "improve", en: "Improve", ko: "\uac1c\uc120", ja: "\u6539\u5584", es: "Mejorar" },
  { value: "summarize", en: "Summarize", ko: "\uc694\uc57d", ja: "\u8981\u7d04", es: "Resumir" },
  {
    value: "simplify",
    en: "Simplify",
    ko: "\uc27d\uac8c \uc815\ub9ac",
    ja: "\u7c21\u6f54\u5316",
    es: "Simplificar",
  },
  {
    value: "consistency_review",
    en: "Consistency review",
    ko: "\uc77c\uad00\uc131 \uac80\ud1a0",
    ja: "\u4e00\u8cab\u6027\u30ec\u30d3\u30e5\u30fc",
    es: "Revisi\u00f3n de consistencia",
  },
  {
    value: "code_review",
    en: "Code review",
    ko: "\ucf54\ub4dc \ub9ac\ubdf0",
    ja: "\u30b3\u30fc\u30c9\u30ec\u30d3\u30e5\u30fc",
    es: "Revisi\u00f3n de c\u00f3digo",
  },
];

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
            {actionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option[language]}
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
            {localize(language, {
              en: "This step is inside a repeat block but is set to Generate / Original input, so it regenerates the same answer each cycle instead of building on prior results.",
              ko: "이 단계는 반복 구간 안에 있지만 '생성 / 원본 입력'이라 매 회차 같은 답을 새로 만들고 이전 결과 위에 쌓지 않습니다.",
              ja: "このステップは繰り返し区間内にありますが「生成 / 元の入力」に設定されているため、毎回同じ答えを作り直し、以前の結果の上に積み重ねません。",
              es: "Este paso está dentro de un bloque de repetición pero está configurado como Generar / Entrada original, por lo que regenera la misma respuesta en cada ciclo en lugar de construir sobre resultados previos.",
            })}
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
            {localize(language, {
              en: "Switch to Brainstorm + prior results",
              ko: "브레인스토밍 + 이전 결과로 바꾸기",
              ja: "ブレインストーミング + 以前の結果に切替",
              es: "Cambiar a Lluvia de ideas + resultados previos",
            })}
          </button>
        </div>
      ) : null}
    </div>
  );
}
