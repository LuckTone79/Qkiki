"use client";

import { useEffect, useState } from "react";
import { ResultCard } from "@/components/workbench/ResultCard";
import type { ProviderOption } from "@/components/workbench/ProviderSelectorRow";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { getActionTypeDisplayLabel } from "@/lib/ai/action-display";
import { getModelDisplayName } from "@/lib/ai/model-display";
import {
  buildCollapsedResultExpansionMap,
  mergeResultExpansionMap,
} from "@/lib/workbench-result-expansion";
import type {
  SharedSessionPayload,
  SharedWorkbenchResult,
} from "@/lib/shared-links";
import { buildResultDomId } from "@/lib/workbench-sharing";

const emptyProviders: ProviderOption[] = [];

function sourceModeLabel(
  sourceMode: string,
  language: "en" | "ko",
  sourceResultId: string | null,
  results: SharedWorkbenchResult[],
) {
  const sourceResult = sourceResultId
    ? results.find((result) => result.id === sourceResultId)
    : null;

  if (sourceMode === "original") {
    return language === "ko" ? "원본 입력" : "Original input";
  }
  if (sourceMode === "previous") {
    return language === "ko" ? "이전 단계" : "Previous step";
  }
  if (sourceMode === "selected_result") {
    return sourceResult
      ? `${language === "ko" ? "선택 결과" : "Selected result"}: ${
          sourceResult.provider
        }/${getModelDisplayName(sourceResult.provider, sourceResult.model)}`
      : language === "ko"
        ? "선택 결과"
        : "Selected result";
  }
  if (sourceMode === "all_current_results") {
    return language === "ko" ? "현재 모든 결과" : "All current results";
  }

  return sourceMode;
}

export function SharedSessionView({
  payload,
  focusedResultId,
}: {
  payload: SharedSessionPayload;
  focusedResultId: string | null;
}) {
  const { language } = useLanguage();
  const { session } = payload;
  const resultById = new Map(session.results.map((result) => [result.id, result]));
  const [resultExpansionById, setResultExpansionById] = useState<Record<string, boolean>>(
    () => buildCollapsedResultExpansionMap(session.results),
  );

  useEffect(() => {
    if (!focusedResultId) {
      return;
    }

    const element = document.getElementById(buildResultDomId(focusedResultId));
    if (!element) {
      return;
    }

    window.requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [focusedResultId]);

  useEffect(() => {
    setResultExpansionById((current) =>
      mergeResultExpansionMap(current, session.results),
    );
  }, [session.results]);

  function depthOf(result: SharedWorkbenchResult): number {
    let depth = 0;
    let current = result;

    while (current.parentResultId) {
      const parent = resultById.get(current.parentResultId);
      if (!parent) {
        break;
      }
      depth += 1;
      current = parent;
    }

    return depth;
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
              {language === "ko" ? "공유된 결과 보기" : "Shared result view"}
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-stone-950">
              {session.title}
            </h1>
            <p className="mt-2 text-sm text-stone-600">
              {session.mode === "sequential"
                ? language === "ko"
                  ? "이 링크는 입력, 워크플로우, 단계별 결과를 모두 보여줍니다."
                  : "This link shows the input, workflow, and every step result."
                : language === "ko"
                  ? "이 링크는 입력과 결과 보드를 로그인 없이 보여줍니다."
                  : "This link shows the input and result board without sign-in."}
            </p>
          </div>
          <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600">
            {session.mode === "sequential"
              ? language === "ko"
                ? "순차 검토 체인"
                : "Sequential review chain"
              : language === "ko"
                ? "병렬 비교"
                : "Parallel compare"}
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-stone-950">
          {language === "ko" ? "입력" : "Input"}
        </h2>
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-stone-200 bg-[#fbfcf8] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              {language === "ko" ? "원본 입력" : "Original input"}
            </p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-800">
              {session.originalInput}
            </p>
          </div>
          {session.additionalInstruction ? (
            <div className="rounded-xl border border-stone-200 bg-[#fbfcf8] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                {language === "ko" ? "추가 지시" : "Additional instruction"}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-800">
                {session.additionalInstruction}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {session.mode === "sequential" ? (
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-stone-950">
            {language === "ko" ? "워크플로우" : "Workflow"}
          </h2>
          <div className="mt-4 grid gap-3">
            {session.workflowSteps.map((step) => (
              <article
                key={step.id}
                className="rounded-xl border border-stone-200 bg-[#fbfcf8] p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-stone-700">
                    {language === "ko" ? `단계 ${step.orderIndex}` : `Step ${step.orderIndex}`}
                  </span>
                  <span className="rounded-full border border-stone-200 px-2.5 py-1 text-xs text-stone-600">
                    {getActionTypeDisplayLabel(step.actionType, language)}
                  </span>
                  <span className="rounded-full border border-stone-200 px-2.5 py-1 text-xs text-stone-600">
                    {step.targetProvider}/{getModelDisplayName(step.targetProvider, step.targetModel)}
                  </span>
                </div>
                <p className="mt-3 text-sm text-stone-600">
                  {sourceModeLabel(
                    step.sourceMode,
                    language,
                    step.sourceResultId,
                    session.results,
                  )}
                </p>
                {step.instructionTemplate ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-800">
                    {step.instructionTemplate}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-stone-950">
            {language === "ko" ? "결과" : "Results"}
          </h2>
          <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600">
            {session.results.length} {language === "ko" ? "개" : "items"}
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {session.results.map((result) => {
            const parent = result.parentResultId
              ? session.results.find((item) => item.id === result.parentResultId)
              : null;

            return (
              <ResultCard
                key={result.id}
                result={result}
                depth={depthOf(result)}
                isFinal={session.finalResultId === result.id}
                isLatestProgress={false}
                providers={emptyProviders}
                expanded={resultExpansionById[result.id] ?? false}
                readOnly
                highlighted={focusedResultId === result.id}
                sourceLabel={
                  parent
                    ? `${language === "ko" ? "소스" : "Source"}: ${
                        parent.provider
                      }/${getModelDisplayName(parent.provider, parent.model)}`
                    : undefined
                }
                onToggleExpanded={(resultId) =>
                  setResultExpansionById((current) => ({
                    ...current,
                    [resultId]: !(current[resultId] ?? false),
                  }))
                }
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
