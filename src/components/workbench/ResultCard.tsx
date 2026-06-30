"use client";

import { type AppLanguage } from "@/lib/i18n";

import { localize } from "@/lib/i18n";

import { FormEvent, useMemo, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { AddToProjectButton } from "@/components/projects/AddToProjectButton";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import type { ProviderOption } from "@/components/workbench/ProviderSelectorRow";
import {
  BRANCH_REVIEW_ACTION_TYPES,
  type ActionType,
  type ProviderName,
  type TargetModelInput,
} from "@/lib/ai/types";
import { getActionTypeDisplayLabel } from "@/lib/ai/action-display";
import { buildResultDomId } from "@/lib/workbench-sharing";
import { copyTextToClipboard } from "@/lib/browser-clipboard";
import {
  getModelDisplayName,
  getModelOptionLabel,
} from "@/lib/ai/model-display";
import { isImageDataUrl } from "@/lib/ai/image-output";

export type WorkbenchResult = {
  id: string;
  executionRunId?: string | null;
  executionOrder?: number | null;
  workflowStepId: string | null;
  parentResultId: string | null;
  branchKey: string | null;
  provider: ProviderName;
  model: string;
  promptSnapshot?: string;
  outputText: string | null;
  status: string;
  errorMessage: string | null;
  tokenUsagePrompt: number | null;
  tokenUsageCompletion: number | null;
  estimatedCost: number | null;
  costIsEstimated: boolean;
  latencyMs: number | null;
  createdAt: string;
  updatedAt: string;
  workflowStep?: {
    orderIndex: number;
    actionType: ActionType;
  } | null;
  executionRunStep?: {
    orderIndex: number;
    templateStepIndex: number;
    repeatIteration: number | null;
    actionType: ActionType;
    targetProvider: string;
    targetModel: string;
    sourceMode: string;
    sourceResultId: string | null;
    status: string;
  } | null;
};

type ResultCardProps = {
  result: WorkbenchResult;
  sessionId?: string | null;
  depth: number;
  compact?: boolean;
  expanded: boolean;
  isFinal: boolean;
  isLatestProgress: boolean;
  providers: ProviderOption[];
  sourceLabel?: string;
  highlighted?: boolean;
  readOnly?: boolean;
  onBranch?: (input: {
    parentResultId: string;
    actionType: ActionType;
    instruction: string;
    targets: TargetModelInput[];
  }) => Promise<void>;
  onRerun?: (resultId: string) => Promise<void>;
  onMarkFinal?: (resultId: string) => Promise<void>;
  onDelete?: (resultId: string) => Promise<void>;
  onShare?: (resultId: string) => Promise<{ url: string; copied: boolean }>;
  onToggleExpanded: (resultId: string) => void;
};

const providerOrder: ProviderName[] = ["openai", "anthropic", "google", "xai"];

function formatDate(value: string, language: AppLanguage) {
  return new Intl.DateTimeFormat(localize(language, { en: "en-US", ko: "ko-KR", ja: "en-US", es: "en-US" }), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatLatencyMs(value: number | null, language: AppLanguage, fallback: string) {
  if (!value || value <= 0) {
    return fallback;
  }

  const seconds = value / 1000;
  const formatted = seconds >= 10 ? seconds.toFixed(1) : seconds.toFixed(2);
  return localize(language, { en: `${formatted} sec`, ko: `${formatted}초`, ja: `${formatted}\u79D2`, es: `${formatted}segundo` });
}

function firstVisibleLine(value: string) {
  const firstLine = value.split(/\r?\n/, 1)[0] ?? "";
  return firstLine.trim() || value.trim();
}

function getExecutionSourceLabel(
  result: WorkbenchResult,
  sourceLabel: string | undefined,
  language: AppLanguage,
  originalSourceLabel: string,
) {
  if (sourceLabel) {
    return sourceLabel;
  }

  const sourceMode = result.executionRunStep?.sourceMode;

  if (sourceMode === "previous") {
    return localize(language, { en: "Source: previous completed result", ko: "소스: 이전 완료 결과", ja: "\u51FA\u5178: \u4EE5\u524D\u306E\u5B8C\u4E86\u7D50\u679C", es: "Fuente: resultado completo anterior" });
  }

  if (sourceMode === "selected_result") {
    return localize(language, { en: "Source: selected result", ko: "소스: 선택한 결과", ja: "\u30BD\u30FC\u30B9: \u9078\u629E\u3055\u308C\u305F\u7D50\u679C", es: "Fuente: resultado seleccionado" });
  }

  if (sourceMode === "all_results") {
    return localize(language, { en: "Source: prior completed results", ko: "소스: 이전 완료 결과 전체", ja: "\u51FA\u5178: \u4EE5\u524D\u306B\u5B8C\u4E86\u3057\u305F\u7D50\u679C", es: "Fuente: resultados completados anteriormente" });
  }

  return originalSourceLabel;
}

export function ResultCard({
  result,
  sessionId,
  depth,
  compact = false,
  expanded,
  isFinal,
  isLatestProgress,
  providers,
  sourceLabel,
  highlighted = false,
  readOnly = false,
  onBranch,
  onRerun,
  onMarkFinal,
  onDelete,
  onShare,
  onToggleExpanded,
}: ResultCardProps) {
  const { language, t } = useLanguage();
  const [composer, setComposer] = useState<"follow_up" | "review" | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [sharedUrl, setSharedUrl] = useState<string | null>(null);
  const [shareCopyBlocked, setShareCopyBlocked] = useState(false);
  const readyProviders = providers.filter((provider) => provider.status === "ready");
  const isRunning = result.status === "running";
  const stepLabel = result.executionRunStep
    ? `${t("step")} ${result.executionRunStep.orderIndex}`
    : result.workflowStep
      ? `${t("step")} ${result.workflowStep.orderIndex}`
      : result.executionOrder
        ? `${t("step")} ${result.executionOrder}`
        : null;
  const templateStepLabel = result.executionRunStep
    ? localize(language, { en: `Template step ${result.executionRunStep.templateStepIndex}`, ko: `템플릿 ${result.executionRunStep.templateStepIndex}단계`, ja: `\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u30B9\u30C6\u30C3\u30D7${result.executionRunStep.templateStepIndex}`, es: `Paso de plantilla${result.executionRunStep.templateStepIndex}` })
    : null;
  const actionLabel = result.executionRunStep
    ? getActionTypeDisplayLabel(result.executionRunStep.actionType, language)
    : result.workflowStep
      ? getActionTypeDisplayLabel(result.workflowStep.actionType, language)
      : null;
  const repeatLabel =
    result.executionRunStep?.repeatIteration && result.executionRunStep.repeatIteration > 0
      ? localize(language, { en: `Iteration ${result.executionRunStep.repeatIteration}`, ko: `${result.executionRunStep.repeatIteration}회차`, ja: `\u53CD\u5FA9${result.executionRunStep.repeatIteration}`, es: `Iteraci\u00F3n${result.executionRunStep.repeatIteration}` })
      : null;

  const meta = useMemo(() => {
    return [
      result.status === "completed"
        ? localize(language, { en: "Comparison generated", ko: "결과 생성 완료", ja: "\u751F\u6210\u3055\u308C\u305F\u6BD4\u8F03", es: "Comparaci\u00F3n generada" })
        : result.status === "failed"
          ? localize(language, { en: "Generation failed", ko: "생성 실패", ja: "\u751F\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F", es: "Generaci\u00F3n fallida" })
          : result.status === "canceled"
            ? localize(language, { en: "Canceled", ko: "중지됨", ja: "\u30AD\u30E3\u30F3\u30BB\u30EB", es: "Cancelado" })
            : localize(language, { en: "Generating", ko: "생성 중", ja: "\u751F\u6210\u4E2D", es: "generando" }),
      formatLatencyMs(result.latencyMs, language, t("latencyNotAvailable")),
    ].join(" / ");
  }, [language, result, t]);

  const displayBody = useMemo(() => {
    if (isRunning) {
      return localize(language, { en: "The model is generating a response. This card will update when the result arrives.", ko: "모델이 응답을 생성하는 중입니다. 결과가 도착하면 이 카드가 자동으로 업데이트됩니다.", ja: "\u30E2\u30C7\u30EB\u306F\u5FDC\u7B54\u3092\u751F\u6210\u3057\u3066\u3044\u307E\u3059\u3002\u7D50\u679C\u304C\u5230\u7740\u3059\u308B\u3068\u3001\u3053\u306E\u30AB\u30FC\u30C9\u306F\u66F4\u65B0\u3055\u308C\u307E\u3059\u3002", es: "El modelo est\u00E1 generando una respuesta. Esta tarjeta se actualizar\u00E1 cuando llegue el resultado." });
    }

    if (result.status === "failed" || result.status === "canceled") {
      return result.errorMessage || t("providerFailed");
    }

    return result.outputText || t("noOutputReturned");
  }, [isRunning, language, result.errorMessage, result.outputText, result.status, t]);

  const imageOutput =
    !isRunning &&
    result.status === "completed" &&
    isImageDataUrl(result.outputText)
      ? result.outputText
      : null;

  const collapsedPreview = useMemo(
    () =>
      imageOutput
        ? localize(language, { en: "🖼 Generated image", ko: "🖼 생성된 이미지", ja: "\uD83D\uDDBC \u751F\u6210\u3055\u308C\u305F\u753B\u50CF", es: "\uD83D\uDDBC Imagen generada" })
        : firstVisibleLine(displayBody),
    [displayBody, imageOutput, language],
  );

  async function copy() {
    const copyResult = await copyTextToClipboard(
      result.outputText || result.errorMessage || "",
    );
    if (copyResult.copied) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    }
  }

  async function share() {
    if (!onShare) {
      return;
    }

    setSharing(true);
    try {
      const outcome = await onShare(result.id);
      setSharedUrl(outcome.url);
      setShareCopyBlocked(!outcome.copied);
      setShareCopied(outcome.copied);
      if (outcome.copied) {
        window.setTimeout(() => setShareCopied(false), 1200);
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <article
      id={buildResultDomId(result.id)}
      className={`rounded-lg border bg-white shadow-sm transition-colors ${
        compact ? "p-3" : "p-3 sm:p-4"
      } ${highlighted ? "border-teal-400 ring-2 ring-teal-200" : "border-stone-200"}`}
      style={{ marginLeft: `${Math.min(depth, 3) * 10}px` }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[#f1f0ee] px-2 py-1 text-xs font-semibold text-teal-800">
              {result.provider} / {getModelDisplayName(result.provider, result.model)}
            </span>
            <StatusBadge status={result.status} />
            {isFinal ? (
              <span className="rounded-md border border-teal-200 bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800">
                {localize(language, { en: "Final result", ko: "최종결과", ja: "\u6700\u7D42\u7D50\u679C", es: "resultado final" })}
              </span>
            ) : null}
            {!isFinal && isLatestProgress ? (
              <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                {localize(language, { en: "Latest result in progress", ko: "진행 step중 최신결과", ja: "\u6700\u65B0\u306E\u7D50\u679C\u304C\u9032\u884C\u4E2D", es: "\u00DAltimo resultado en progreso" })}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-stone-500">
            {[
              stepLabel,
              templateStepLabel,
              repeatLabel,
              actionLabel,
              getExecutionSourceLabel(result, sourceLabel, language, t("sourceOriginal")),
              formatDate(result.createdAt, language),
            ]
              .filter(Boolean)
              .join(" / ")}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-start justify-between gap-2 self-start sm:w-auto sm:flex-nowrap sm:justify-end">
          <button
            type="button"
            onClick={() => onToggleExpanded(result.id)}
            className="shrink-0 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
          >
            {expanded
              ? localize(language, { en: "Collapse", ko: "접기", ja: "\u5D29\u58CA", es: "Colapsar" })
              : localize(language, { en: "Expand", ko: "펼치기", ja: "\u62E1\u5927\u3059\u308B", es: "Expandir" })}
          </button>
          <p className="min-w-0 break-words pt-1 text-xs text-stone-500">{meta}</p>
        </div>
      </div>

      <div
        className={`mt-4 rounded-md border border-stone-200 bg-[#f7f6f3] text-stone-800 ${
          compact ? "p-2.5 text-[13px] leading-5" : "p-3 text-sm leading-6"
        }`}
      >
        {imageOutput ? (
          expanded ? (
            <figure className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageOutput}
                alt={localize(language, { en: "Generated image", ko: "생성된 이미지", ja: "\u751F\u6210\u3055\u308C\u305F\u753B\u50CF", es: "Imagen generada" })}
                className="w-full max-w-md rounded-md border border-stone-200 object-contain"
              />
              <a
                href={imageOutput}
                download={`yapp-image-${result.id}.png`}
                className="inline-block text-xs font-semibold text-teal-700 underline"
              >
                {localize(language, { en: "Download image", ko: "이미지 다운로드", ja: "\u753B\u50CF\u3092\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9", es: "Descargar imagen" })}
              </a>
            </figure>
          ) : (
            <p className="truncate">{collapsedPreview}</p>
          )
        ) : expanded ? (
          <p className="whitespace-pre-wrap">{displayBody}</p>
        ) : (
          <p className="truncate">{collapsedPreview}</p>
        )}
      </div>

      {isRunning || readOnly ? null : (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            disabled={!onBranch}
            onClick={() => setComposer(composer === "follow_up" ? null : "follow_up")}
            className="min-h-10 rounded-md bg-stone-950 px-3 py-2 text-xs font-semibold text-white hover:bg-stone-800"
          >
            {t("followUp")}
          </button>
          <button
            type="button"
            disabled={!onBranch}
            onClick={() => setComposer(composer === "review" ? null : "review")}
            className="min-h-10 rounded-md border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
          >
            {t("reviewWithModel")}
          </button>
          <button
            type="button"
            disabled={!onRerun}
            onClick={() => onRerun?.(result.id)}
            className="min-h-10 rounded-md border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
          >
            {t("rerun")}
          </button>
          <button
            type="button"
            onClick={copy}
            className="min-h-10 rounded-md border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
          >
            {copied ? t("copied") : t("copy")}
          </button>
          {onShare ? (
            <button
              type="button"
              disabled={sharing}
              onClick={share}
              className="min-h-10 rounded-md border border-sky-300 px-3 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-50 disabled:opacity-60"
            >
              {sharing
                ? localize(language, { en: "Sharing...", ko: "공유 중...", ja: "\u5171\u6709\u4E2D...", es: "Compartiendo..." })
                : shareCopied
                  ? localize(language, { en: "Link copied", ko: "링크 복사됨", ja: "\u30EA\u30F3\u30AF\u304C\u30B3\u30D4\u30FC\u3055\u308C\u307E\u3057\u305F", es: "Enlace copiado" })
                  : localize(language, { en: "Share result", ko: "결과 공유", ja: "\u7D50\u679C\u3092\u5171\u6709\u3059\u308B", es: "Compartir resultado" })}
            </button>
          ) : null}
          <button
            type="button"
            disabled={!onMarkFinal}
            onClick={() => onMarkFinal?.(result.id)}
            className="min-h-10 rounded-md border border-teal-300 px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-50"
          >
            {t("markFinal")}
          </button>
          <button
            type="button"
            disabled={!onDelete}
            onClick={() => onDelete?.(result.id)}
            className="min-h-10 rounded-md border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
          >
            {t("deleteBranch")}
          </button>
          {sessionId ? (
            <AddToProjectButton
              payload={{
                kind: "RESULT",
                sessionId,
                resultId: result.id,
                title: `${actionLabel || (localize(language, { en: "Result", ko: "결과", ja: "\u7D50\u679C", es: "Resultado" }))} · ${result.provider}/${getModelDisplayName(result.provider, result.model)}`,
              }}
              className="min-h-10 rounded-md border border-indigo-300 px-3 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-50"
            />
          ) : null}
        </div>
      )}

      {!readOnly && sharedUrl ? (
        <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-3">
          {shareCopyBlocked ? (
            <p className="mb-2 text-xs font-medium text-sky-900">
              {localize(language, { en: "Automatic copying was blocked. The link was still created, so open it or select it below.", ko: "자동 복사가 차단됐습니다. 링크는 정상 생성됐으니 아래에서 열거나 직접 복사해 주세요.", ja: "\u81EA\u52D5\u30B3\u30D4\u30FC\u304C\u30D6\u30ED\u30C3\u30AF\u3055\u308C\u307E\u3057\u305F\u3002\u30EA\u30F3\u30AF\u306F\u307E\u3060\u4F5C\u6210\u3055\u308C\u3066\u3044\u308B\u306E\u3067\u3001\u305D\u308C\u3092\u958B\u304F\u304B\u3001\u4E0B\u304B\u3089\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002", es: "Se bloque\u00F3 la copia autom\u00E1tica. El enlace a\u00FAn se cre\u00F3, as\u00ED que \u00E1brelo o selecci\u00F3nalo a continuaci\u00F3n." })}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={sharedUrl}
              onFocus={(event) => event.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700"
              aria-label={localize(language, { en: "Shared result link", ko: "결과 공유 링크", ja: "\u5171\u6709\u7D50\u679C\u30EA\u30F3\u30AF", es: "Enlace de resultado compartido" })}
            />
            <a
              href={sharedUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-sky-300 bg-white px-3 py-2 text-center text-xs font-semibold text-sky-900 hover:bg-sky-100"
            >
              {localize(language, { en: "Open link", ko: "링크 열기", ja: "\u30EA\u30F3\u30AF\u3092\u958B\u304F", es: "Abrir enlace" })}
            </a>
          </div>
        </div>
      ) : null}

      {composer && !isRunning && !readOnly && onBranch ? (
        <BranchComposer
          mode={composer}
          parentResult={result}
          providers={readyProviders.length ? readyProviders : providers}
          onSubmit={async (values) => {
            await onBranch({ parentResultId: result.id, ...values });
            setComposer(null);
          }}
        />
      ) : null}
    </article>
  );
}

function BranchComposer({
  mode,
  parentResult,
  providers,
  onSubmit,
}: {
  mode: "follow_up" | "review";
  parentResult: WorkbenchResult;
  providers: ProviderOption[];
  onSubmit: (input: {
    actionType: ActionType;
    instruction: string;
    targets: TargetModelInput[];
  }) => Promise<void>;
}) {
  const { language, t } = useLanguage();
  const [actionType, setActionType] = useState<ActionType>(
    mode === "follow_up" ? "follow_up" : "critique",
  );
  const [instruction, setInstruction] = useState("");
  const [selectedModels, setSelectedModels] = useState<Record<string, string[]>>(() => {
    const first = providers[0];
    return first ? { [first.providerName]: [first.defaultModel] } : {};
  });
  const [submitting, setSubmitting] = useState(false);
  const [expandedProvider, setExpandedProvider] = useState<ProviderName | null>(
    providers[0]?.providerName ?? null,
  );

  const orderedProviders = useMemo(
    () =>
      [...providers].sort(
        (left, right) =>
          providerOrder.indexOf(left.providerName) - providerOrder.indexOf(right.providerName),
      ),
    [providers],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    const targets = orderedProviders.flatMap((provider) =>
      (selectedModels[provider.providerName] ?? []).map((model) => ({
        provider: provider.providerName,
        model,
      })),
    );

    if (!targets.length || !instruction.trim()) {
      return;
    }

    setSubmitting(true);
    await onSubmit({ actionType, instruction, targets });
    setSubmitting(false);
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 rounded-lg border border-stone-200 bg-[#f7f6f3] p-3"
    >
      <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
        <label className="block">
          <span className="text-xs font-medium text-stone-500">
            {mode === "follow_up" ? t("followUp") : t("reviewType")}
          </span>
          <select
            value={actionType}
            disabled={mode === "follow_up"}
            onChange={(event) => setActionType(event.target.value as ActionType)}
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2 py-2 text-sm outline-none focus:border-teal-600 disabled:bg-stone-100"
          >
            {mode === "follow_up" ? (
              <option value="follow_up">{t("followUp")}</option>
            ) : (
              BRANCH_REVIEW_ACTION_TYPES.map((actionType) => (
                <option key={actionType} value={actionType}>
                  {getActionTypeDisplayLabel(actionType, language)}
                </option>
              ))
            )}
          </select>
        </label>

        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-stone-500">{t("targetModels")}</p>
              <p className="mt-1 text-[11px] text-stone-400">
                {localize(language, { en: "Choose a provider first, then expand only the models you need.", ko: "공급자를 먼저 고르고 필요한 세부 모델만 펼쳐서 선택합니다.", ja: "\u6700\u521D\u306B\u30D7\u30ED\u30D0\u30A4\u30C0\u30FC\u3092\u9078\u629E\u3057\u3001\u5FC5\u8981\u306A\u30E2\u30C7\u30EB\u306E\u307F\u3092\u62E1\u5F35\u3057\u307E\u3059\u3002", es: "Primero elija un proveedor y luego ampl\u00EDe solo los modelos que necesite." })}
              </p>
            </div>
            <span className="rounded-full border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-500">
              {localize(language, { en: `From ${parentResult.provider}/${getModelDisplayName(
                    parentResult.provider,
                    parentResult.model,
                  )}`, ko: `기준 결과: ${parentResult.provider}/${getModelDisplayName(
                    parentResult.provider,
                    parentResult.model,
                  )}`, ja: `\u304B\u3089${parentResult.provider}/${getModelDisplayName(parentResult.provider, parentResult.model)}`, es: `De${parentResult.provider}/${getModelDisplayName(parentResult.provider, parentResult.model)}` })}
            </span>
          </div>
          <div className="mt-2 space-y-3">
            {orderedProviders.map((provider) => (
              <div
                key={provider.providerName}
                className="rounded-md border border-stone-200 bg-white p-3"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedProvider((current) =>
                      current === provider.providerName ? null : provider.providerName,
                    )
                  }
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div>
                    <p className="text-xs font-semibold text-stone-700">
                      {provider.shortName}
                    </p>
                    <p className="mt-1 text-[11px] text-stone-500">
                      {(selectedModels[provider.providerName] ?? []).length > 0
                        ? localize(language, { en: `${(selectedModels[provider.providerName] ?? []).length} model(s) selected`, ko: `${(selectedModels[provider.providerName] ?? []).length}개 모델 선택`, ja: `${(selectedModels[provider.providerName] ?? []).length}\u9078\u629E\u3055\u308C\u305F\u30E2\u30C7\u30EB`, es: `${(selectedModels[provider.providerName] ?? []).length}modelo(s) seleccionado(s)` })
                        : localize(language, { en: "No models selected", ko: "선택된 모델 없음", ja: "\u30E2\u30C7\u30EB\u304C\u9078\u629E\u3055\u308C\u3066\u3044\u307E\u305B\u3093", es: "No hay modelos seleccionados" })}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-stone-500">
                    {expandedProvider === provider.providerName
                      ? localize(language, { en: "Hide", ko: "접기", ja: "\u96A0\u308C\u308B", es: "Esconder" })
                      : localize(language, { en: "Show models", ko: "모델 보기", ja: "\u30E2\u30C7\u30EB\u3092\u8868\u793A\u3059\u308B", es: "Mostrar modelos" })}
                  </span>
                </button>
                {expandedProvider === provider.providerName ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {provider.models.map((model) => {
                      const checked = (selectedModels[provider.providerName] ?? []).includes(
                        model,
                      );
                      return (
                        <label
                          key={`${provider.providerName}-${model}`}
                          className={`min-h-9 rounded-md border px-2 py-2 text-xs ${
                            checked
                              ? "border-teal-300 bg-teal-50 text-teal-900"
                              : "border-stone-300 bg-white text-stone-700"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              const current = selectedModels[provider.providerName] ?? [];
                              const next = event.target.checked
                                ? [...current, model]
                                : current.filter((item) => item !== model);
                              setSelectedModels({
                                ...selectedModels,
                                [provider.providerName]: next,
                              });
                            }}
                            className="mr-1 accent-teal-700"
                          />
                          {getModelOptionLabel(provider.providerName, model)}
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      <textarea
        value={instruction}
        onChange={(event) => setInstruction(event.target.value)}
        rows={3}
        className="mt-3 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
        placeholder={
          mode === "follow_up" ? t("followUpPlaceholder") : t("reviewPlaceholder")
        }
      />

      <button
        type="submit"
        disabled={submitting || !instruction.trim()}
        className="mt-3 w-full rounded-md bg-teal-700 px-3 py-2.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-60 sm:w-auto"
      >
        {submitting ? t("runningShort") : t("runBranch")}
      </button>
    </form>
  );
}
