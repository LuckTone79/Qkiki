"use client";

import { FormEvent, useMemo, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { AddToProjectButton } from "@/components/projects/AddToProjectButton";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import type { ProviderOption } from "@/components/workbench/ProviderSelectorRow";
import type { ActionType, ProviderName, TargetModelInput } from "@/lib/ai/types";
import { getActionTypeDisplayLabel } from "@/lib/ai/action-display";
import { buildResultDomId } from "@/lib/workbench-sharing";
import { copyTextToClipboard } from "@/lib/browser-clipboard";
import {
  getModelDisplayName,
  getModelOptionLabel,
} from "@/lib/ai/model-display";

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

const reviewTypes: { value: ActionType; en: string; ko: string }[] = [
  { value: "brainstorm", en: "Brainstorm", ko: "브레인스토밍" },
  { value: "critique", en: "Critique", ko: "비판" },
  {
    value: "fact_check",
    en: "Fact-check style review",
    ko: "팩트체크식 검토",
  },
  { value: "improve", en: "Improve", ko: "개선" },
  { value: "summarize", en: "Summarize", ko: "요약" },
  { value: "simplify", en: "Simplify", ko: "쉽게 정리" },
  {
    value: "consistency_review",
    en: "Consistency review",
    ko: "일관성 검토",
  },
  { value: "code_review", en: "Code review", ko: "코드 리뷰" },
];

const providerOrder: ProviderName[] = ["openai", "anthropic", "google", "xai"];

function formatDate(value: string, language: "en" | "ko") {
  return new Intl.DateTimeFormat(language === "ko" ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatLatencyMs(value: number | null, language: "en" | "ko", fallback: string) {
  if (!value || value <= 0) {
    return fallback;
  }

  const seconds = value / 1000;
  const formatted = seconds >= 10 ? seconds.toFixed(1) : seconds.toFixed(2);
  return language === "ko" ? `${formatted}초` : `${formatted} sec`;
}

function firstVisibleLine(value: string) {
  const firstLine = value.split(/\r?\n/, 1)[0] ?? "";
  return firstLine.trim() || value.trim();
}

function getExecutionSourceLabel(
  result: WorkbenchResult,
  sourceLabel: string | undefined,
  language: "en" | "ko",
  originalSourceLabel: string,
) {
  if (sourceLabel) {
    return sourceLabel;
  }

  const sourceMode = result.executionRunStep?.sourceMode;

  if (sourceMode === "previous") {
    return language === "ko"
      ? "소스: 이전 완료 결과"
      : "Source: previous completed result";
  }

  if (sourceMode === "selected_result") {
    return language === "ko"
      ? "소스: 선택한 결과"
      : "Source: selected result";
  }

  if (sourceMode === "all_results") {
    return language === "ko"
      ? "소스: 이전 완료 결과 전체"
      : "Source: prior completed results";
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
    ? language === "ko"
      ? `템플릿 ${result.executionRunStep.templateStepIndex}단계`
      : `Template step ${result.executionRunStep.templateStepIndex}`
    : null;
  const actionLabel = result.executionRunStep
    ? getActionTypeDisplayLabel(result.executionRunStep.actionType, language)
    : result.workflowStep
      ? getActionTypeDisplayLabel(result.workflowStep.actionType, language)
      : null;
  const repeatLabel =
    result.executionRunStep?.repeatIteration && result.executionRunStep.repeatIteration > 0
      ? language === "ko"
        ? `${result.executionRunStep.repeatIteration}회차`
        : `Iteration ${result.executionRunStep.repeatIteration}`
      : null;

  const meta = useMemo(() => {
    return [
      result.status === "completed"
        ? language === "ko"
          ? "결과 생성 완료"
          : "Comparison generated"
        : result.status === "failed"
          ? language === "ko"
            ? "생성 실패"
            : "Generation failed"
          : result.status === "canceled"
            ? language === "ko"
              ? "중지됨"
              : "Canceled"
            : language === "ko"
              ? "생성 중"
              : "Generating",
      formatLatencyMs(result.latencyMs, language, t("latencyNotAvailable")),
    ].join(" / ");
  }, [language, result, t]);

  const displayBody = useMemo(() => {
    if (isRunning) {
      return language === "ko"
        ? "모델이 응답을 생성하는 중입니다. 결과가 도착하면 이 카드가 자동으로 업데이트됩니다."
        : "The model is generating a response. This card will update when the result arrives.";
    }

    if (result.status === "failed" || result.status === "canceled") {
      return result.errorMessage || t("providerFailed");
    }

    return result.outputText || t("noOutputReturned");
  }, [isRunning, language, result.errorMessage, result.outputText, result.status, t]);

  const collapsedPreview = useMemo(() => firstVisibleLine(displayBody), [displayBody]);

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
                {language === "ko" ? "최종결과" : "Final result"}
              </span>
            ) : null}
            {!isFinal && isLatestProgress ? (
              <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                {language === "ko" ? "진행 step중 최신결과" : "Latest result in progress"}
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
        <div className="flex items-start gap-2 self-start">
          <button
            type="button"
            onClick={() => onToggleExpanded(result.id)}
            className="shrink-0 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
          >
            {expanded
              ? language === "ko"
                ? "접기"
                : "Collapse"
              : language === "ko"
                ? "펼치기"
                : "Expand"}
          </button>
          <p className="pt-1 text-xs text-stone-500">{meta}</p>
        </div>
      </div>

      <div
        className={`mt-4 rounded-md border border-stone-200 bg-[#f7f6f3] text-stone-800 ${
          compact ? "p-2.5 text-[13px] leading-5" : "p-3 text-sm leading-6"
        }`}
      >
        {expanded ? (
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
                ? language === "ko"
                  ? "공유 중..."
                  : "Sharing..."
                : shareCopied
                  ? language === "ko"
                    ? "링크 복사됨"
                    : "Link copied"
                  : language === "ko"
                    ? "결과 공유"
                    : "Share result"}
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
                title: `${actionLabel || (language === "ko" ? "결과" : "Result")} · ${result.provider}/${getModelDisplayName(result.provider, result.model)}`,
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
              {language === "ko"
                ? "자동 복사가 차단됐습니다. 링크는 정상 생성됐으니 아래에서 열거나 직접 복사해 주세요."
                : "Automatic copying was blocked. The link was still created, so open it or select it below."}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={sharedUrl}
              onFocus={(event) => event.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700"
              aria-label={language === "ko" ? "결과 공유 링크" : "Shared result link"}
            />
            <a
              href={sharedUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-sky-300 bg-white px-3 py-2 text-center text-xs font-semibold text-sky-900 hover:bg-sky-100"
            >
              {language === "ko" ? "링크 열기" : "Open link"}
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
              reviewTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {language === "ko" ? type.ko : type.en}
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
                {language === "ko"
                  ? "공급자를 먼저 고르고 필요한 세부 모델만 펼쳐서 선택합니다."
                  : "Choose a provider first, then expand only the models you need."}
              </p>
            </div>
            <span className="rounded-full border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-500">
              {language === "ko"
                ? `기준 결과: ${parentResult.provider}/${getModelDisplayName(
                    parentResult.provider,
                    parentResult.model,
                  )}`
                : `From ${parentResult.provider}/${getModelDisplayName(
                    parentResult.provider,
                    parentResult.model,
                  )}`}
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
                        ? language === "ko"
                          ? `${(selectedModels[provider.providerName] ?? []).length}개 모델 선택`
                          : `${(selectedModels[provider.providerName] ?? []).length} model(s) selected`
                        : language === "ko"
                          ? "선택된 모델 없음"
                          : "No models selected"}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-stone-500">
                    {expandedProvider === provider.providerName
                      ? language === "ko"
                        ? "접기"
                        : "Hide"
                      : language === "ko"
                        ? "모델 보기"
                        : "Show models"}
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
