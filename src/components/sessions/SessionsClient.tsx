"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { SectionHeader } from "@/components/SectionHeader";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type SessionListItem = {
  id: string;
  title: string;
  originalInput: string;
  mode: string;
  project: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  _count: { results: number; workflowSteps: number };
};

function formatDate(value: string, language: "en" | "ko") {
  return new Intl.DateTimeFormat(language === "ko" ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function displayMode(mode: string, t: ReturnType<typeof useLanguage>["t"]) {
  return mode === "sequential" ? t("sequentialReviewChain") : t("parallelCompare");
}

export function SessionsClient() {
  const { language, t } = useLanguage();
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [error, setError] = useState("");

  async function loadSessions() {
    const response = await fetch("/api/sessions");
    const data = (await response.json().catch(() => ({}))) as {
      sessions?: SessionListItem[];
      error?: string;
    };

    if (!response.ok || !data.sessions) {
      setError(
        language === "ko"
          ? t("couldNotLoadSessions")
          : data.error || t("couldNotLoadSessions"),
      );
      return;
    }

    setSessions(data.sessions);
  }

  async function duplicateSession(id: string) {
    const response = await fetch(`/api/sessions/${id}/duplicate`, {
      method: "POST",
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };

    if (!response.ok) {
      setError(
        language === "ko"
          ? t("couldNotDuplicateSession")
          : data.error || t("couldNotDuplicateSession"),
      );
      return;
    }

    await loadSessions();
  }

  async function deleteSession(id: string) {
    if (!window.confirm(t("deleteSessionConfirm"))) {
      return;
    }

    const response = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    if (response.ok) {
      setSessions((current) => current.filter((session) => session.id !== id));
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
                    onClick={() => duplicateSession(session.id)}
                    className="rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
                  >
                    {t("duplicate")}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSession(session.id)}
                    className="rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    {t("delete")}
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
