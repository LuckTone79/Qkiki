"use client";

import { useEffect, useState } from "react";
import { ResultCard } from "@/components/workbench/ResultCard";
import type { ProviderOption } from "@/components/workbench/ProviderSelectorRow";
import {
  localize,
  useLanguage,
  type AppLanguage,
} from "@/components/i18n/LanguageProvider";
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
  language: AppLanguage,
  sourceResultId: string | null,
  results: SharedWorkbenchResult[],
) {
  const sourceResult = sourceResultId
    ? results.find((result) => result.id === sourceResultId)
    : null;

  const selectedResultLabel = localize(language, {
    en: "Selected result",
    ko: "선택 결과",
    ja: "選択した結果",
    es: "Resultado seleccionado",
  });

  if (sourceMode === "original") {
    return localize(language, {
      en: "Original input",
      ko: "원본 입력",
      ja: "元の入力",
      es: "Entrada original",
    });
  }
  if (sourceMode === "previous") {
    return localize(language, {
      en: "Previous step",
      ko: "이전 단계",
      ja: "前のステップ",
      es: "Paso anterior",
    });
  }
  if (sourceMode === "selected_result") {
    return sourceResult
      ? `${selectedResultLabel}: ${
          sourceResult.provider
        }/${getModelDisplayName(sourceResult.provider, sourceResult.model)}`
      : selectedResultLabel;
  }
  if (sourceMode === "all_current_results") {
    return localize(language, {
      en: "All current results",
      ko: "현재 모든 결과",
      ja: "現在のすべての結果",
      es: "Todos los resultados actuales",
    });
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
  const isResultOnly = payload.scope === "RESULT";
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
              {localize(language, {
                en: "Shared result view",
                ko: "공유된 결과 보기",
                ja: "共有された結果ビュー",
                es: "Vista de resultado compartido",
              })}
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-stone-950">
              {session.title}
            </h1>
            <p className="mt-2 text-sm text-stone-600">
              {session.mode === "sequential"
                ? localize(language, {
                    en: "This link shows the input, workflow, and every step result.",
                    ko: "이 링크는 입력, 워크플로우, 단계별 결과를 모두 보여줍니다.",
                    ja: "このリンクでは入力、ワークフロー、各ステップの結果がすべて表示されます。",
                    es: "Este enlace muestra la entrada, el flujo de trabajo y el resultado de cada paso.",
                  })
                : localize(language, {
                    en: "This link shows the input and result board without sign-in.",
                    ko: "이 링크는 입력과 결과 보드를 로그인 없이 보여줍니다.",
                    ja: "このリンクでは入力と結果ボードがログインなしで表示されます。",
                    es: "Este enlace muestra la entrada y el tablero de resultados sin iniciar sesión.",
                  })}
            </p>
          </div>
          <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600">
            {session.mode === "sequential"
              ? localize(language, {
                  en: "Sequential review chain",
                  ko: "순차 검토 체인",
                  ja: "順次レビューチェーン",
                  es: "Cadena de revisión secuencial",
                })
              : localize(language, {
                  en: "Parallel compare",
                  ko: "병렬 비교",
                  ja: "並列比較",
                  es: "Comparación paralela",
                })}
          </span>
        </div>
      </section>

      {!isResultOnly ? <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-stone-950">
          {localize(language, { en: "Input", ko: "입력", ja: "入力", es: "Entrada" })}
        </h2>
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-stone-200 bg-[#f4f5f6] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              {localize(language, {
                en: "Original input",
                ko: "원본 입력",
                ja: "元の入力",
                es: "Entrada original",
              })}
            </p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-800">
              {session.originalInput}
            </p>
          </div>
          {session.additionalInstruction ? (
            <div className="rounded-xl border border-stone-200 bg-[#f4f5f6] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                {localize(language, {
                  en: "Additional instruction",
                  ko: "추가 지시",
                  ja: "追加指示",
                  es: "Instrucción adicional",
                })}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-800">
                {session.additionalInstruction}
              </p>
            </div>
          ) : null}
        </div>
      </section> : null}

      {!isResultOnly && session.mode === "sequential" ? (
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-stone-950">
            {localize(language, {
              en: "Workflow",
              ko: "워크플로우",
              ja: "ワークフロー",
              es: "Flujo de trabajo",
            })}
          </h2>
          <div className="mt-4 grid gap-3">
            {session.workflowSteps.map((step) => (
              <article
                key={step.id}
                className="rounded-xl border border-stone-200 bg-[#f4f5f6] p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-stone-700">
                    {localize(language, {
                      en: `Step ${step.orderIndex}`,
                      ko: `단계 ${step.orderIndex}`,
                      ja: `ステップ ${step.orderIndex}`,
                      es: `Paso ${step.orderIndex}`,
                    })}
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
            {localize(language, {
              en: "Results",
              ko: "결과",
              ja: "結果",
              es: "Resultados",
            })}
          </h2>
          <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600">
            {session.results.length}{" "}
            {localize(language, {
              en: "items",
              ko: "개",
              ja: "件",
              es: "elementos",
            })}
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
                    ? `${localize(language, {
                        en: "Source",
                        ko: "소스",
                        ja: "ソース",
                        es: "Fuente",
                      })}: ${
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
