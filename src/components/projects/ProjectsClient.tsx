"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { SectionHeader } from "@/components/SectionHeader";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type ProjectListItem = {
  id: string;
  name: string;
  description: string | null;
  sharedContext: string | null;
  updatedAt: string;
  _count: { sessions: number };
  sessions: Array<{
    id: string;
    title: string;
    updatedAt: string;
    _count: { results: number };
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

const projectSettingsText = {
  en: {
    defaultGuideline: "Default AI guideline",
    defaultGuidelinePlaceholder:
      "Baseline instruction AI should follow in this project",
  },
  ko: {
    defaultGuideline: "AI \uAE30\uBCF8 \uC9C0\uCE68",
    defaultGuidelinePlaceholder:
      "\uC774 \uD504\uB85C\uC81D\uD2B8\uC5D0\uC11C AI\uAC00 \uAE30\uBCF8\uC73C\uB85C \uCC38\uACE0\uD560 \uC9C0\uCE68",
  },
} as const;

export function ProjectsClient() {
  const { language, t } = useLanguage();
  const settingsText = projectSettingsText[language];
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sharedContext, setSharedContext] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const hasProjects = useMemo(() => projects.length > 0, [projects]);

  async function loadProjects() {
    const response = await fetch("/api/projects");
    const data = (await response.json().catch(() => ({}))) as {
      projects?: ProjectListItem[];
      error?: string;
    };

    if (!response.ok || !data.projects) {
      setError(
        language === "ko"
          ? t("couldNotLoadProjects")
          : data.error || t("couldNotLoadProjects"),
      );
      return;
    }

    setProjects(data.projects);
  }

  async function createProject(event: FormEvent) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const shouldStartConversation = submitter?.dataset.start === "true";
    setError("");
    setNotice("");

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, sharedContext }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      project?: { id: string; name: string };
      error?: string;
    };

    if (!response.ok || !data.project) {
      setError(
        language === "ko"
          ? t("couldNotCreateProject")
          : data.error || t("couldNotCreateProject"),
      );
      return;
    }

    setName("");
    setDescription("");
    setSharedContext("");
    setShowCreate(false);

    if (shouldStartConversation) {
      window.location.href = `/app/workbench?project=${data.project.id}`;
      return;
    }

    setNotice(`${t("projectCreated")} ${data.project.name}`);
    await loadProjects();
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setShowCreate(params.get("create") === "1");
    loadProjects();
    // Load project list once on entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow={t("projects")}
        title={t("projectsTitle")}
        description={t("projectsDescription")}
        action={
          <button
            type="button"
            onClick={() => setShowCreate((current) => !current)}
            className="rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
          >
            {t("newProject")}
          </button>
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

      {showCreate ? (
        <form
          onSubmit={(event) => createProject(event)}
          className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
        >
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
            <label className="block">
              <span className="text-sm font-medium text-stone-700">
                {t("projectName")}
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
                placeholder={t("projectNamePlaceholder")}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-stone-700">
                {t("description")}
              </span>
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
                placeholder={t("projectPurposePlaceholder")}
              />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="text-sm font-medium text-stone-700">
              {settingsText.defaultGuideline}
            </span>
            <textarea
              value={sharedContext}
              onChange={(event) => setSharedContext(event.target.value)}
              rows={4}
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm leading-6 outline-none focus:border-teal-600"
              placeholder={settingsText.defaultGuidelinePlaceholder}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
            >
              {t("createProject")}
            </button>
            <button
              type="submit"
              data-start="true"
              className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              {t("createAndStart")}
            </button>
          </div>
        </form>
      ) : null}

      {hasProjects ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {projects.map((project) => (
            <article
              key={project.id}
              className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-stone-400">[ ]</span>
                    <h2 className="text-lg font-semibold text-stone-950">
                      {project.name}
                    </h2>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-stone-600">
                    {project.description || t("noDescription")}
                  </p>
                  <p className="mt-3 text-xs text-stone-500">
                    {project._count.sessions} {t("conversationWindows")} -{" "}
                    {t("updated")}{" "}
                    {formatDate(project.updatedAt, language)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/app/projects/${project.id}`}
                    className="rounded-md bg-stone-950 px-3 py-2 text-sm font-semibold text-white hover:bg-stone-800"
                  >
                    {t("open")}
                  </Link>
                  <Link
                    href={`/app/workbench?project=${project.id}`}
                    className="rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
                  >
                    {t("newWindow")}
                  </Link>
                </div>
              </div>

              {project.sessions.length ? (
                <div className="mt-4 space-y-2 border-t border-stone-200 pt-3">
                  {project.sessions.map((session) => (
                    <Link
                      key={session.id}
                      href={`/app/workbench?session=${session.id}`}
                      className="block rounded-md border border-stone-200 bg-[#fbfcf8] px-3 py-2 hover:bg-[#e9f7ef]"
                    >
                      <span className="block truncate text-sm font-medium text-stone-800">
                        {session.title}
                      </span>
                      <span className="text-xs text-stone-500">
                        {session._count.results} {t("results")} -{" "}
                        {formatDate(session.updatedAt, language)}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title={t("noProjectsTitle")}
          description={t("noProjectsDescription")}
          action={
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
            >
              {t("createFirstProject")}
            </button>
          }
        />
      )}
    </div>
  );
}
