"use client";

import { useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { getModelDisplayName } from "@/lib/ai/model-display";
import type { ProviderName } from "@/lib/ai/types";

const text = {
  en: {
    rawContent: "Raw content",
    viewRaw: "View raw content",
    loading: "Loading...",
    failedLoad: "Failed to load raw content.",
    originalInput: "Original input",
    encrypted: "Raw input/output is encrypted at rest and revealed only when explicitly requested.",
  },
  ko: {
    rawContent: "원문 내용",
    viewRaw: "원문 보기",
    loading: "로딩 중...",
    failedLoad: "원문을 불러오지 못했습니다.",
    originalInput: "원본 입력",
    encrypted: "원문 입출력은 저장 시 암호화되어 있으며, 명시적으로 요청할 때만 복호화됩니다.",
  },
} as const;

type RawPayload = {
  conversationId: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  originalInput: string;
  results: Array<{
    id: string;
    provider: string;
    model: string;
    outputText: string | null;
    errorMessage: string | null;
    createdAt: string;
  }>;
};

export function AdminConversationRawViewer({
  conversationId,
}: {
  conversationId: string;
}) {
  const { language } = useLanguage();
  const t = text[language];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [raw, setRaw] = useState<RawPayload | null>(null);

  async function loadRaw() {
    setLoading(true);
    setError("");

    const response = await fetch(`/api/admin/conversations/${conversationId}/raw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessReasonCode: "raw_view_button" }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      raw?: RawPayload;
    };

    if (!response.ok || !data.raw) {
      setError(data.error || t.failedLoad);
      setLoading(false);
      return;
    }

    setRaw(data.raw);
    setLoading(false);
  }

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-slate-900">{t.rawContent}</h2>
        <button
          type="button"
          onClick={loadRaw}
          disabled={loading}
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:w-auto"
        >
          {loading ? t.loading : t.viewRaw}
        </button>
      </div>

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {raw ? (
        <div className="space-y-3">
          <article className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t.originalInput}
            </p>
            <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-900">{raw.originalInput}</pre>
          </article>

          <div className="space-y-2">
            {raw.results.map((result) => (
              <article key={result.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {result.provider}/
                  {getModelDisplayName(
                    result.provider as ProviderName,
                    result.model,
                  )}
                </p>
                <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-900">
                  {result.outputText || result.errorMessage || "(empty)"}
                </pre>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-600">{t.encrypted}</p>
      )}
    </section>
  );
}
