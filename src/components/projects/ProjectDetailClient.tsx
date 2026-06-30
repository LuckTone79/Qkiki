"use client";

import { type AppLanguage } from "@/lib/i18n";

import { withAdditionalLanguages } from "@/lib/i18n";

import { localize } from "@/lib/i18n";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { SectionHeader } from "@/components/SectionHeader";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type ProjectDetail = {
  id: string;
  name: string;
  description: string | null;
  sharedContext: string | null;
  updatedAt: string;
  _count: { sessions: number };
  sessions: Array<{
    id: string;
    title: string;
    originalInput: string;
    mode: string;
    updatedAt: string;
    _count: { results: number; workflowSteps: number };
  }>;
  items: Array<{
    id: string;
    kind: "SESSION" | "RESULT";
    title: string;
    note: string | null;
    createdAt: string;
    session: { id: string; title: string; mode: string } | null;
    result: {
      id: string;
      provider: string;
      model: string;
      status: string;
      snippet: string;
    } | null;
  }>;
};

function formatDate(value: string, language: AppLanguage) {
  return new Intl.DateTimeFormat(localize(language, { en: "en-US", ko: "ko-KR", ja: "en-US", es: "en-US" }), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function displayMode(mode: string, t: ReturnType<typeof useLanguage>["t"]) {
  return mode === "sequential" ? t("sequentialReviewChain") : t("parallelCompare");
}

const projectDetailText = withAdditionalLanguages({
  en: {
    settingsTitle: "Project settings",
    settingsDescription:
      "Update project name and baseline guidance that AI should reference in this project.",
    defaultGuideline: "Default AI guideline",
    defaultGuidelinePlaceholder:
      "Persistent instruction AI should always reference for this project",
  },
  ko: {
    settingsTitle: "\uD504\uB85C\uC81D\uD2B8 \uC124\uC815",
    settingsDescription:
      "\uD504\uB85C\uC81D\uD2B8 \uC774\uB984\uACFC AI\uAC00 \uCC38\uACE0\uD560 \uAE30\uBCF8 \uC9C0\uCE68\uC744 \uC124\uC815\uD569\uB2C8\uB2E4.",
    defaultGuideline: "AI \uAE30\uBCF8 \uC9C0\uCE68",
    defaultGuidelinePlaceholder:
      "\uC774 \uD504\uB85C\uC81D\uD2B8\uC5D0\uC11C AI\uAC00 \uD56D\uC0C1 \uCC38\uACE0\uD560 \uC9C0\uCE68",
  },
});

export function ProjectDetailClient({ projectId }: { projectId: string }) {
  const { language, t } = useLanguage();
  const detailText = projectDetailText[language];
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sharedContext, setSharedContext] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [savingProject, setSavingProject] = useState(false);
  const [projectSavedAt, setProjectSavedAt] = useState<number | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);

  async function loadProject() {
    const response = await fetch(`/api/projects/${projectId}`);
    const data = (await response.json().catch(() => ({}))) as {
      project?: ProjectDetail;
      error?: string;
    };

    if (!response.ok || !data.project) {
      setError(
        localize(language, { en: data.error || t("couldNotLoadProject"), ko: t("couldNotLoadProject"), ja: data.error || t("couldNotLoadProject"), es: data.error || t("couldNotLoadProject") }),
      );
      return;
    }

    setProject(data.project);
    setName(data.project.name);
    setDescription(data.project.description || "");
    setSharedContext(data.project.sharedContext || "");
  }

  async function saveProject(event: FormEvent) {
    event.preventDefault();
    if (savingProject) return;
    setNotice("");
    setError("");
    setSavingProject(true);

    const response = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, sharedContext }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      project?: ProjectDetail;
      error?: string;
    };

    if (!response.ok || !data.project) {
      setError(
        localize(language, { en: data.error || t("couldNotSaveProject"), ko: t("couldNotSaveProject"), ja: data.error || t("couldNotSaveProject"), es: data.error || t("couldNotSaveProject") }),
      );
      setSavingProject(false);
      return;
    }

    setNotice(t("projectContextSaved"));
    setProjectSavedAt(Date.now());
    setTimeout(() => setProjectSavedAt(null), 2000);
    setSavingProject(false);
    await loadProject();
  }

  async function removeItem(itemId: string) {
    if (
      !window.confirm(
        localize(language, { en: "Remove this item from the project? The original stays in your session.", ko: "이 항목을 프로젝트에서 제거할까요? 원본 대화/결과는 세션에 그대로 남습니다.", ja: "\u3053\u306E\u9805\u76EE\u3092\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u304B\u3089\u524A\u9664\u3057\u307E\u3059\u304B?\u30AA\u30EA\u30B8\u30CA\u30EB\u306F\u30BB\u30C3\u30B7\u30E7\u30F3\u5185\u306B\u6B8B\u308A\u307E\u3059\u3002", es: "\u00BFEliminar este elemento del proyecto? El original permanece en su sesi\u00F3n." }),
      )
    ) {
      return;
    }

    const response = await fetch(
      `/api/projects/${projectId}/items/${itemId}`,
      { method: "DELETE" },
    );
    if (response.ok) {
      setProject((current) =>
        current
          ? { ...current, items: current.items.filter((item) => item.id !== itemId) }
          : current,
      );
    }
  }

  async function deleteProject() {
    if (!window.confirm(t("deleteProjectConfirm"))) {
      return;
    }

    setDeletingProject(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        window.location.href = "/app/projects";
      }
    } finally {
      setDeletingProject(false);
    }
  }

  useEffect(() => {
    loadProject();
    // Load this project once for the dynamic route id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!project) {
    return (
      <div className="space-y-5">
        <SectionHeader
          eyebrow={t("project")}
          title={t("loadingProject")}
          description={t("loadingProjectDescription")}
        />
        {error ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow={t("project")}
        title={project.name}
        description={t("projectFolderDescription")}
        action={
          <Link
            href={`/app/workbench?project=${project.id}`}
            className="rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
          >
            {t("newConversationWindow")}
          </Link>
        }
      />

      {notice ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <form
          onSubmit={saveProject}
          className="order-2 rounded-lg border border-stone-200 bg-white p-4 shadow-sm xl:order-1"
        >
          <h2 className="text-base font-semibold text-stone-950">
            {detailText.settingsTitle}
          </h2>
          <p className="mt-1 text-sm leading-6 text-stone-600">
            {detailText.settingsDescription}
          </p>

          <label className="mt-4 block">
            <span className="text-sm font-medium text-stone-700">
              {t("name")}
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
            />
          </label>

          <label className="mt-3 block">
            <span className="text-sm font-medium text-stone-700">
              {t("description")}
            </span>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
              placeholder={t("themePurposeWorkingArea")}
            />
          </label>

          <label className="mt-3 block">
            <span className="text-sm font-medium text-stone-700">
              {detailText.defaultGuideline}
            </span>
            <textarea
              value={sharedContext}
              onChange={(event) => setSharedContext(event.target.value)}
              rows={10}
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm leading-6 outline-none focus:border-teal-600"
              placeholder={detailText.defaultGuidelinePlaceholder}
            />
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={savingProject}
              className={`rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed ${projectSavedAt ? "bg-teal-500" : "bg-teal-700 hover:bg-teal-800 disabled:opacity-60"}`}
            >
              {savingProject
                ? (localize(language, { en: "Saving…", ko: "저장 중…", ja: "\u4FDD\u5B58\u4E2D\u2026", es: "Guardando\u2026" }))
                : projectSavedAt
                  ? (localize(language, { en: "Saved ✓", ko: "저장됨 ✓", ja: "\u4FDD\u5B58\u6E08\u307F \u2713", es: "Guardado \u2713" }))
                  : t("saveProject")}
            </button>
            <button
              type="button"
              onClick={deleteProject}
              disabled={deletingProject}
              className="rounded-md border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deletingProject
                ? (localize(language, { en: "Deleting…", ko: "삭제 중…", ja: "\u524A\u9664\u4E2D\u2026", es: "Eliminando\u2026" }))
                : t("deleteFolder")}
            </button>
          </div>
        </form>

        <section className="order-1 space-y-3 xl:order-2">
          <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-stone-950">
              {localize(language, { en: "Collected items", ko: "추가된 대화/결과", ja: "\u53CE\u96C6\u30A2\u30A4\u30C6\u30E0", es: "Art\u00EDculos recolectados" })}
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              {localize(language, { en: `${project.items.length} conversations and individual results added from your sessions. Originals stay in their sessions.`, ko: `세션에서 추가한 대화와 개별 결과 ${project.items.length}개. 원본은 세션에 그대로 남아 있습니다.`, ja: `${project.items.length}\u30BB\u30C3\u30B7\u30E7\u30F3\u304B\u3089\u8FFD\u52A0\u3055\u308C\u305F\u4F1A\u8A71\u3068\u500B\u3005\u306E\u7D50\u679C\u3002\u30AA\u30EA\u30B8\u30CA\u30EB\u306F\u30BB\u30C3\u30B7\u30E7\u30F3\u5185\u306B\u6B8B\u308A\u307E\u3059\u3002`, es: `${project.items.length}conversaciones y resultados individuales agregados de sus sesiones. Los originales permanecen en sus sesiones.` })}
            </p>
          </div>

          {project.items.length ? (
            <div className="grid gap-3">
              {project.items.map((item) => (
                <article
                  key={item.id}
                  className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`flex-none rounded-md border px-2 py-1 text-xs font-semibold ${
                            item.kind === "RESULT"
                              ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                              : "border-teal-200 bg-teal-50 text-teal-800"
                          }`}
                        >
                          {item.kind === "RESULT"
                            ? localize(language, { en: "Single result", ko: "단일 결과", ja: "\u5358\u4E00\u306E\u7D50\u679C", es: "resultado \u00FAnico" })
                            : localize(language, { en: "Full conversation", ko: "대화 전체", ja: "\u4F1A\u8A71\u5168\u4F53", es: "conversaci\u00F3n completa" })}
                        </span>
                      </div>
                      <h3 className="mt-2 line-clamp-2 break-words text-base font-semibold text-stone-950">
                        {item.title}
                      </h3>
                      {item.kind === "RESULT" && item.result ? (
                        <>
                          <p className="mt-1 break-words text-xs text-stone-500">
                            {item.result.provider} / {item.result.model}
                          </p>
                          <p className="mt-2 line-clamp-3 break-words whitespace-pre-wrap text-sm leading-6 text-stone-600">
                            {item.result.snippet}
                          </p>
                        </>
                      ) : null}
                      {item.session ? (
                        <p className="mt-2 break-words text-xs text-stone-500">
                          {localize(language, { en: "From session", ko: "출처 세션", ja: "\u30BB\u30C3\u30B7\u30E7\u30F3\u304B\u3089", es: "De la sesi\u00F3n" })}:{" "}
                          {item.session.title}
                        </p>
                      ) : null}
                    </div>
                    <div className="grid w-full grid-cols-2 gap-2 lg:flex lg:w-auto lg:flex-none lg:flex-wrap">
                      {item.session ? (
                        <Link
                          href={`/app/workbench?session=${item.session.id}`}
                          className="rounded-md bg-stone-950 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-stone-800"
                        >
                          {t("open")}
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className={`${item.session ? "" : "col-span-2 "}rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50`}
                      >
                        {localize(language, { en: "Remove", ko: "제거", ja: "\u53D6\u308A\u9664\u304F", es: "Eliminar" })}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-stone-950">
              {t("conversationWindows")}
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              {project._count.sessions} {t("savedSessionsLinked")}
            </p>
          </div>

          {project.sessions.length ? (
            <div className="grid gap-3">
              {project.sessions.map((session) => (
                <article
                  key={session.id}
                  className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-stone-950">
                          {session.title}
                        </h3>
                        <span className="rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-600">
                          {displayMode(session.mode, t)}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-stone-600">
                        {session.originalInput}
                      </p>
                      <p className="mt-3 text-xs text-stone-500">
                        {session._count.results} {t("results")} -{" "}
                        {session._count.workflowSteps} {t("steps")} -{" "}
                        {t("updated")} {formatDate(session.updatedAt, language)}
                      </p>
                    </div>
                    <Link
                      href={`/app/workbench?session=${session.id}`}
                      className="w-full rounded-md bg-stone-950 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-stone-800 lg:w-auto"
                    >
                      {t("open")}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title={t("noConversationWindowsTitle")}
              description={t("noConversationWindowsDescription")}
              action={
                <Link
                  href={`/app/workbench?project=${project.id}`}
                  className="rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
                >
                  {t("startFirstWindow")}
                </Link>
              }
            />
          )}
        </section>
      </div>
    </div>
  );
}
