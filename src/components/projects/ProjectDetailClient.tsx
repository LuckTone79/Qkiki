"use client";

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

const projectDetailText = {
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
} as const;

export function ProjectDetailClient({ projectId }: { projectId: string }) {
  const { language, t } = useLanguage();
  const detailText = projectDetailText[language];
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sharedContext, setSharedContext] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function loadProject() {
    const response = await fetch(`/api/projects/${projectId}`);
    const data = (await response.json().catch(() => ({}))) as {
      project?: ProjectDetail;
      error?: string;
    };

    if (!response.ok || !data.project) {
      setError(
        language === "ko"
          ? t("couldNotLoadProject")
          : data.error || t("couldNotLoadProject"),
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
    setNotice("");
    setError("");

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
        language === "ko"
          ? t("couldNotSaveProject")
          : data.error || t("couldNotSaveProject"),
      );
      return;
    }

    setNotice(t("projectContextSaved"));
    await loadProject();
  }

  async function deleteProject() {
    if (!window.confirm(t("deleteProjectConfirm"))) {
      return;
    }

    const response = await fetch(`/api/projects/${projectId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      window.location.href = "/app/projects";
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
          className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
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
              className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              {t("saveProject")}
            </button>
            <button
              type="button"
              onClick={deleteProject}
              className="rounded-md border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
            >
              {t("deleteFolder")}
            </button>
          </div>
        </form>

        <section className="space-y-3">
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
                    <div>
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
                      className="rounded-md bg-stone-950 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-stone-800"
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
