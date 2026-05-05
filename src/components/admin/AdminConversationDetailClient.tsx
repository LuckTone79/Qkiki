"use client";

import { useLanguage } from "@/components/i18n/LanguageProvider";
import { AdminConversationRawViewer } from "@/components/admin/AdminConversationRawViewer";

const text = {
  en: {
    updated: "Updated",
    workflowSteps: "Workflow steps",
    step: "Step",
    source: "Source:",
    noSteps: "No workflow steps recorded.",
    resultsMeta: "Results metadata",
    tokens: "Tokens:",
    cost: "Cost:",
    latency: "Latency:",
    est: "(est)",
    noResults: "No results yet.",
  },
  ko: {
    updated: "업데이트",
    workflowSteps: "워크플로우 단계",
    step: "단계",
    source: "출처:",
    noSteps: "기록된 워크플로우 단계가 없습니다.",
    resultsMeta: "결과 메타데이터",
    tokens: "토큰:",
    cost: "비용:",
    latency: "지연:",
    est: "(추정)",
    noResults: "아직 결과가 없습니다.",
  },
} as const;

export type ConversationDetailData = {
  id: string;
  title: string;
  updatedAt: string;
  userName: string;
  userEmail: string;
  workflowSteps: Array<{
    id: string;
    orderIndex: number;
    actionType: string;
    targetProvider: string;
    targetModel: string;
    sourceMode: string;
  }>;
  results: Array<{
    id: string;
    provider: string;
    model: string;
    status: string;
    errorMessage: string | null;
    tokenUsagePrompt: number | null;
    tokenUsageCompletion: number | null;
    estimatedCost: number | null;
    costIsEstimated: boolean;
    latencyMs: number | null;
  }>;
};

export function AdminConversationDetailClient({
  conversation,
}: {
  conversation: ConversationDetailData;
}) {
  const { language } = useLanguage();
  const t = text[language];
  const locale = language === "ko" ? "ko-KR" : "en-US";

  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="break-words text-2xl font-semibold tracking-tight text-slate-950">
          {conversation.title}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {conversation.userName} ({conversation.userEmail})
        </p>
        <p className="mt-2 text-xs text-slate-500">
          {t.updated}{" "}
          {new Intl.DateTimeFormat(locale, {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(conversation.updatedAt))}
        </p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">{t.workflowSteps}</h2>
        {conversation.workflowSteps.length ? (
          <div className="mt-3 space-y-2">
            {conversation.workflowSteps.map((step) => (
              <div
                key={step.id}
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <p className="font-medium text-slate-900">
                  {t.step} {step.orderIndex}: {step.actionType} {"→"}{" "}
                  {step.targetProvider}/{step.targetModel}
                </p>
                <p className="text-xs text-slate-500">
                  {t.source} {step.sourceMode}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">{t.noSteps}</p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">{t.resultsMeta}</h2>
        {conversation.results.length ? (
          <div className="mt-3 space-y-2">
            {conversation.results.map((result) => (
              <div
                key={result.id}
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-medium text-slate-900">
                    {result.provider}/{result.model}
                  </p>
                  <span className="text-xs text-slate-500">{result.status}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {t.tokens} {result.tokenUsagePrompt ?? 0}/{result.tokenUsageCompletion ?? 0} |{" "}
                  {t.cost} {result.estimatedCost ?? 0}{" "}
                  {result.costIsEstimated ? t.est : ""} |{" "}
                  {t.latency} {result.latencyMs ?? 0}ms
                </p>
                {result.errorMessage ? (
                  <p className="mt-1 text-xs text-rose-700">{result.errorMessage}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">{t.noResults}</p>
        )}
      </section>

      <AdminConversationRawViewer conversationId={conversation.id} />
    </div>
  );
}
