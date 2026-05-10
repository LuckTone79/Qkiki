"use client";

import { FormEvent, useMemo, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import type { ProviderOption } from "@/components/workbench/ProviderSelectorRow";
import type { ActionType, ProviderName, TargetModelInput } from "@/lib/ai/types";

export type WorkbenchResult = {
  id: string;
  workflowStepId: string | null;
  parentResultId: string | null;
  branchKey: string | null;
  provider: ProviderName;
  model: string;
  promptSnapshot: string;
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
};

type ResultCardProps = {
  result: WorkbenchResult;
  depth: number;
  isFinal: boolean;
  providers: ProviderOption[];
  sourceLabel?: string;
  onBranch: (input: {
    parentResultId: string;
    actionType: ActionType;
    instruction: string;
    targets: TargetModelInput[];
  }) => Promise<void>;
  onRerun: (resultId: string) => Promise<void>;
  onMarkFinal: (resultId: string) => Promise<void>;
  onDelete: (resultId: string) => Promise<void>;
};

const reviewTypes: { value: ActionType; en: string; ko: string }[] = [
  { value: "critique", en: "Critique", ko: "\ube44\ud310" },
  {
    value: "fact_check",
    en: "Fact-check style review",
    ko: "\ud329\ud2b8\uccb4\ud06c\uc2dd \uac80\ud1a0",
  },
  { value: "improve", en: "Improve", ko: "\uac1c\uc120" },
  { value: "summarize", en: "Summarize", ko: "\uc694\uc57d" },
  { value: "simplify", en: "Simplify", ko: "\uc27d\uac8c \uc815\ub9ac" },
  {
    value: "consistency_review",
    en: "Consistency review",
    ko: "\uc77c\uad00\uc131 \uac80\ud1a0",
  },
];

function formatDate(value: string, language: "en" | "ko") {
  return new Intl.DateTimeFormat(language === "ko" ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ResultCard({
  result,
  depth,
  isFinal,
  providers,
  sourceLabel,
  onBranch,
  onRerun,
  onMarkFinal,
  onDelete,
}: ResultCardProps) {
  const { language, t } = useLanguage();
  const [composer, setComposer] = useState<"follow_up" | "review" | null>(null);
  const [copied, setCopied] = useState(false);
  const readyProviders = providers.filter((provider) => provider.status === "ready");

  const meta = useMemo(() => {
    const prompt = result.tokenUsagePrompt ?? 0;
    const completion = result.tokenUsageCompletion ?? 0;
    const cost =
      result.estimatedCost !== null
        ? `$${result.estimatedCost.toFixed(5)}${
            result.costIsEstimated ? ` ${t("estimatedShort")}` : ""
          }`
        : t("costNotAvailable");

    return [
      prompt || completion
        ? `${prompt}/${completion} ${t("tokens")}`
        : t("usageNotAvailable"),
      result.latencyMs ? `${result.latencyMs} ms` : t("latencyNotAvailable"),
      cost,
    ].join(" / ");
  }, [result, t]);

  async function copy() {
    await navigator.clipboard.writeText(result.outputText || result.errorMessage || "");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <article
      className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm sm:p-4"
      style={{ marginLeft: `${Math.min(depth, 3) * 10}px` }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[#e9f7ef] px-2 py-1 text-xs font-semibold text-teal-800">
              {result.provider} / {result.model}
            </span>
            <StatusBadge status={result.status} />
            {isFinal ? (
              <span className="rounded-md border border-teal-200 bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800">
                {t("final")}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-stone-500">
            {sourceLabel ?? t("sourceOriginal")} /{" "}
            {formatDate(result.createdAt, language)}
          </p>
        </div>
        <p className="text-xs text-stone-500">{meta}</p>
      </div>

      <div className="mt-4 whitespace-pre-wrap rounded-md border border-stone-200 bg-[#fbfcf8] p-3 text-sm leading-6 text-stone-800">
        {result.status === "failed"
          ? result.errorMessage || t("providerFailed")
          : result.outputText || t("noOutputReturned")}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <button
          type="button"
          onClick={() => setComposer(composer === "follow_up" ? null : "follow_up")}
          className="min-h-10 rounded-md bg-stone-950 px-3 py-2 text-xs font-semibold text-white hover:bg-stone-800"
        >
          {t("followUp")}
        </button>
        <button
          type="button"
          onClick={() => setComposer(composer === "review" ? null : "review")}
          className="min-h-10 rounded-md border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
        >
          {t("reviewWithModel")}
        </button>
        <button
          type="button"
          onClick={() => onRerun(result.id)}
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
        <button
          type="button"
          onClick={() => onMarkFinal(result.id)}
          className="min-h-10 rounded-md border border-teal-300 px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-50"
        >
          {t("markFinal")}
        </button>
        <button
          type="button"
          onClick={() => onDelete(result.id)}
          className="min-h-10 rounded-md border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
        >
          {t("deleteBranch")}
        </button>
      </div>

      {composer ? (
        <BranchComposer
          mode={composer}
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
  providers,
  onSubmit,
}: {
  mode: "follow_up" | "review";
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

  async function submit(event: FormEvent) {
    event.preventDefault();
    const targets = providers.flatMap((provider) =>
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
      className="mt-4 rounded-lg border border-stone-200 bg-[#fbfcf8] p-3"
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
          <p className="text-xs font-medium text-stone-500">{t("targetModels")}</p>
          <div className="mt-2 space-y-3">
            {providers.map((provider) => (
              <div
                key={provider.providerName}
                className="rounded-md border border-stone-200 bg-white p-3"
              >
                <p className="text-xs font-semibold text-stone-700">
                  {provider.shortName}
                </p>
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
                            const current =
                              selectedModels[provider.providerName] ?? [];
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
                        {model}
                      </label>
                    );
                  })}
                </div>
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
