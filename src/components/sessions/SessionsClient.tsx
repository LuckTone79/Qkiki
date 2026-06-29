"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { SectionHeader } from "@/components/SectionHeader";
import { AddToProjectButton } from "@/components/projects/AddToProjectButton";
import {
  intlLocale,
  localize,
  useLanguage,
  type AppLanguage,
} from "@/components/i18n/LanguageProvider";
import { copyTextToClipboard } from "@/lib/browser-clipboard";
import { buildSessionInputCopyNotice } from "@/lib/session-input-copy";

type SessionListItem = {
  id: string;
  title: string;
  originalInput: string;
  mode: string;
  project: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  _count: { results: number; workflowSteps: number };
  executionRuns: Array<{
    id: string;
    mode: string;
    status: string;
    totalStepsPlanned: number;
    totalStepsDone: number;
    finalResultId: string | null;
    updatedAt: string;
  }>;
};

function formatDate(value: string, language: AppLanguage) {
  return new Intl.DateTimeFormat(intlLocale(language), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function displayMode(mode: string, t: ReturnType<typeof useLanguage>["t"]) {
  return mode === "sequential" ? t("sequentialReviewChain") : t("parallelCompare");
}

function formatRunSummary(session: SessionListItem, language: AppLanguage) {
  const latestRun = session.executionRuns[0];
  if (!latestRun) {
    return localize(language, {
      en: "No runs yet.",
      ko: "아직 실행 기록이 없습니다.",
      ja: "まだ実行履歴がありません。",
      es: "Aún no hay ejecuciones.",
    });
  }

  const stepsDone = `${latestRun.totalStepsDone}/${latestRun.totalStepsPlanned}`;
  const resultCount = session._count.results;
  const doneLabel =
    latestRun.mode === "sequential"
      ? localize(language, {
          en: `${stepsDone} steps done`,
          ko: `${stepsDone}단계 완료`,
          ja: `${stepsDone} ステップ完了`,
          es: `${stepsDone} pasos completados`,
        })
      : localize(language, {
          en: `${resultCount} results saved`,
          ko: `${resultCount}개 결과 저장`,
          ja: `${resultCount} 件の結果を保存`,
          es: `${resultCount} resultados guardados`,
        });

  const statusLabel =
    latestRun.status === "completed"
      ? localize(language, {
          en: "Completed",
          ko: "완료",
          ja: "完了",
          es: "Completado",
        })
      : latestRun.status === "failed"
        ? localize(language, {
            en: "Failed",
            ko: "실패",
            ja: "失敗",
            es: "Fallido",
          })
        : latestRun.status === "canceled"
          ? localize(language, {
              en: "Canceled",
              ko: "중지됨",
              ja: "中止",
              es: "Cancelado",
            })
          : latestRun.status === "running"
            ? localize(language, {
                en: "Running",
                ko: "진행 중",
                ja: "実行中",
                es: "En ejecución",
              })
            : localize(language, {
                en: "Queued",
                ko: "대기 중",
                ja: "待機中",
                es: "En cola",
              });

  const finalLabel = latestRun.finalResultId
    ? localize(language, {
        en: "Final result picked",
        ko: "최종결과 선택됨",
        ja: "最終結果を選択済み",
        es: "Resultado final elegido",
      })
    : localize(language, {
        en: "Final result pending",
        ko: "최종결과 미선택",
        ja: "最終結果は未選択",
        es: "Resultado final pendiente",
      });

  return `${statusLabel} · ${doneLabel} · ${finalLabel}`;
}

export function SessionsClient() {
  const { language, t } = useLanguage();
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copyingInputId, setCopyingInputId] = useState<string | null>(null);
  const [copiedInputId, setCopiedInputId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadSessions() {
    const response = await fetch("/api/sessions");
    const data = (await response.json().catch(() => ({}))) as {
      sessions?: SessionListItem[];
      error?: string;
    };

    if (!response.ok || !data.sessions) {
      setError(
        language === "en"
          ? data.error || t("couldNotLoadSessions")
          : t("couldNotLoadSessions"),
      );
      return;
    }

    setSessions(data.sessions);
  }

  async function duplicateSession(id: string) {
    if (duplicatingId) return;
    setDuplicatingId(id);
    try {
      const response = await fetch(`/api/sessions/${id}/duplicate`, {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        setError(
          language === "en"
            ? data.error || t("couldNotDuplicateSession")
            : t("couldNotDuplicateSession"),
        );
        return;
      }

      await loadSessions();
    } finally {
      setDuplicatingId(null);
    }
  }

  async function deleteSession(id: string) {
    if (!window.confirm(t("deleteSessionConfirm"))) {
      return;
    }

    setDeletingId(id);
    try {
      const response = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      if (response.ok) {
        setSessions((current) => current.filter((session) => session.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  }

  async function copySessionInput(id: string, originalInput: string) {
    if (copyingInputId) return;
    setCopyingInputId(id);
    try {
      const outcome = await copyTextToClipboard(originalInput);
      setNotice(
        buildSessionInputCopyNotice({
          language,
          copied: outcome.copied,
        }),
      );
      if (outcome.copied) {
        setCopiedInputId(id);
        setTimeout(() => setCopiedInputId(null), 1500);
      }
    } finally {
      setCopyingInputId(null);
    }
  }

  useEffect(() => {
    loadSessions();
    // Load session history once on entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow={t("sessions")}
        title={t("savedOrchestrationWork")}
        description={t("sessionsDescriptionFull")}
        action={
          <Link
            href="/app/workbench"
            className="rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
          >
            {t("newWorkbench")}
          </Link>
        }
      />

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {notice}
        </div>
      ) : null}

      {sessions.length ? (
        <div className="grid gap-3">
          {sessions.map((session) => (
            <article
              key={session.id}
              className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-stone-950">
                      {session.title}
                    </h2>
                    <span className="rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-600">
                      {displayMode(session.mode, t)}
                    </span>
                    {session.project ? (
                      <Link
                        href={`/app/projects/${session.project.id}`}
                        className="rounded-md border border-teal-200 bg-teal-50 px-2 py-1 text-xs font-medium text-teal-800 hover:bg-teal-100"
                      >
                        {t("project")}: {session.project.name}
                      </Link>
                    ) : null}
                  </div>
                  <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-stone-600">
                    {session.originalInput}
                  </p>
                  <p className="mt-3 text-xs text-stone-500">
                    {t("updatedAt")} {formatDate(session.updatedAt, language)} -{" "}
                    {session._count.results} {t("results")} -{" "}
                    {session._count.workflowSteps} {t("steps")}
                  </p>
                  <p className="mt-2 text-sm font-medium text-stone-700">
                    {formatRunSummary(session, language)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/app/workbench?session=${session.id}`}
                    className="rounded-md bg-stone-950 px-3 py-2 text-sm font-semibold text-white hover:bg-stone-800"
                  >
                    {t("open")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => copySessionInput(session.id, session.originalInput)}
                    disabled={!!copyingInputId}
                    className={`rounded-md border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${copiedInputId === session.id ? "border-teal-300 bg-teal-50 text-teal-700" : "border-stone-300 text-stone-700 hover:bg-stone-50"}`}
                  >
                    {copiedInputId === session.id
                      ? localize(language, {
                          en: "Copied",
                          ko: "복사됨",
                          ja: "コピーしました",
                          es: "Copiado",
                        })
                      : localize(language, {
                          en: "Copy input",
                          ko: "질문 복사",
                          ja: "入力をコピー",
                          es: "Copiar entrada",
                        })}
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicateSession(session.id)}
                    disabled={duplicatingId === session.id}
                    className="rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {duplicatingId === session.id
                      ? localize(language, {
                          en: "Duplicating…",
                          ko: "복제 중…",
                          ja: "複製中…",
                          es: "Duplicando…",
                        })
                      : t("duplicate")}
                  </button>
                  <AddToProjectButton
                    payload={{
                      kind: "SESSION",
                      sessionId: session.id,
                      title: session.title,
                    }}
                    className="rounded-md border border-indigo-300 px-3 py-2 text-sm font-semibold text-indigo-800 hover:bg-indigo-50"
                  />
                  <button
                    type="button"
                    onClick={() => deleteSession(session.id)}
                    disabled={deletingId === session.id}
                    className="rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingId === session.id
                      ? localize(language, {
                          en: "Deleting…",
                          ko: "삭제 중…",
                          ja: "削除中…",
                          es: "Eliminando…",
                        })
                      : t("delete")}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title={t("noSavedSessionsTitle")}
          description={t("noSavedSessionsDescription")}
        />
      )}
    </div>
  );
}
