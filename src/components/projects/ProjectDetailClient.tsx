"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { SectionHeader } from "@/components/SectionHeader";
import { withoutProjectSession } from "@/lib/project-detail-state";
import {
  intlLocale,
  localize,
  useLanguage,
  type AppLanguage,
} from "@/components/i18n/LanguageProvider";

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

type ProjectSession = ProjectDetail["sessions"][number];

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
  ja: {
    settingsTitle: "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u8A2D\u5B9A",
    settingsDescription:
      "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u540D\u3068\u3001\u3053\u306E\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u3067 AI \u304C\u53C2\u7167\u3059\u308B\u57FA\u672C\u30AC\u30A4\u30C9\u30E9\u30A4\u30F3\u3092\u8A2D\u5B9A\u3057\u307E\u3059\u3002",
    defaultGuideline: "AI \u306E\u57FA\u672C\u30AC\u30A4\u30C9\u30E9\u30A4\u30F3",
    defaultGuidelinePlaceholder:
      "\u3053\u306E\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u3067 AI \u304C\u5E38\u306B\u53C2\u7167\u3059\u308B\u6052\u4E45\u7684\u306A\u6307\u793A",
  },
  es: {
    settingsTitle: "Ajustes del proyecto",
    settingsDescription:
      "Actualiza el nombre del proyecto y la directriz base que la IA debe consultar en este proyecto.",
    defaultGuideline: "Directriz de IA predeterminada",
    defaultGuidelinePlaceholder:
      "Instrucci\u00F3n persistente que la IA debe consultar siempre en este proyecto",
  },
} as const;

const projectRemovalText = {
  en: {
    delete: "Delete",
    dialogTitle: "Remove conversation",
    chooseDescription: "Choose what to do with this project conversation.",
    unlink: "Remove from project only",
    unlinkHelp: "Keep the original conversation and results in Sessions.",
    permanent: "Delete original permanently",
    permanentHelp: "Delete the conversation and its results. This cannot be undone.",
    cancel: "Cancel",
    confirmTitle: "Permanently delete this conversation?",
    confirmDescription: "The original conversation and its results will be deleted and cannot be recovered.",
    confirm: "Delete permanently",
    back: "Back",
    unlinking: "Removing…",
    deleting: "Deleting…",
    unlinkSuccess: "Conversation removed from the project. The original is still in Sessions.",
    permanentSuccess: "Conversation permanently deleted.",
    failed: "Could not update this conversation. Please try again.",
  },
  ko: {
    delete: "삭제",
    dialogTitle: "대화 삭제",
    chooseDescription: "이 프로젝트 대화를 어떻게 처리할지 선택하세요.",
    unlink: "프로젝트에서만 제거",
    unlinkHelp: "원본 대화와 결과는 세션에 그대로 보존합니다.",
    permanent: "원본까지 영구 삭제",
    permanentHelp: "대화와 결과를 모두 삭제합니다. 되돌릴 수 없습니다.",
    cancel: "취소",
    confirmTitle: "이 대화를 영구 삭제할까요?",
    confirmDescription: "원본 대화와 모든 결과가 삭제되며 복구할 수 없습니다.",
    confirm: "영구 삭제",
    back: "돌아가기",
    unlinking: "제거 중…",
    deleting: "삭제 중…",
    unlinkSuccess: "프로젝트에서 대화를 제거했습니다. 원본은 세션에 보존됩니다.",
    permanentSuccess: "대화를 영구 삭제했습니다.",
    failed: "대화를 처리하지 못했습니다. 다시 시도하세요.",
  },
  ja: {
    delete: "削除",
    dialogTitle: "会話を削除",
    chooseDescription: "このプロジェクトの会話をどのように処理するか選択してください。",
    unlink: "プロジェクトからのみ削除",
    unlinkHelp: "元の会話と結果はセッションに保存されます。",
    permanent: "元の会話も完全に削除",
    permanentHelp: "会話と結果を削除します。この操作は元に戻せません。",
    cancel: "キャンセル",
    confirmTitle: "この会話を完全に削除しますか？",
    confirmDescription: "元の会話とすべての結果が削除され、復元できません。",
    confirm: "完全に削除",
    back: "戻る",
    unlinking: "削除中…",
    deleting: "削除中…",
    unlinkSuccess: "プロジェクトから会話を削除しました。元の会話はセッションに残っています。",
    permanentSuccess: "会話を完全に削除しました。",
    failed: "会話を処理できませんでした。もう一度お試しください。",
  },
  es: {
    delete: "Eliminar",
    dialogTitle: "Eliminar conversación",
    chooseDescription: "Elige qué hacer con esta conversación del proyecto.",
    unlink: "Quitar solo del proyecto",
    unlinkHelp: "Conserva la conversación y los resultados originales en Sesiones.",
    permanent: "Eliminar el original permanentemente",
    permanentHelp: "Elimina la conversación y sus resultados. No se puede deshacer.",
    cancel: "Cancelar",
    confirmTitle: "¿Eliminar permanentemente esta conversación?",
    confirmDescription: "La conversación original y todos sus resultados se eliminarán sin posibilidad de recuperación.",
    confirm: "Eliminar permanentemente",
    back: "Volver",
    unlinking: "Quitando…",
    deleting: "Eliminando…",
    unlinkSuccess: "La conversación se quitó del proyecto. El original sigue en Sesiones.",
    permanentSuccess: "La conversación se eliminó permanentemente.",
    failed: "No se pudo actualizar la conversación. Inténtalo de nuevo.",
  },
} as const;

export function ProjectDetailClient({ projectId }: { projectId: string }) {
  const { language, t } = useLanguage();
  const detailText = projectDetailText[language];
  const removalText = projectRemovalText[language];
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sharedContext, setSharedContext] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [savingProject, setSavingProject] = useState(false);
  const [projectSavedAt, setProjectSavedAt] = useState<number | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ProjectSession | null>(null);
  const [removalStage, setRemovalStage] = useState<"choose" | "confirm-permanent">("choose");
  const [removalAction, setRemovalAction] = useState<"unlink" | "permanent" | null>(null);
  const [removalError, setRemovalError] = useState("");

  async function loadProject() {
    const response = await fetch(`/api/projects/${projectId}`);
    const data = (await response.json().catch(() => ({}))) as {
      project?: ProjectDetail;
      error?: string;
    };

    if (!response.ok || !data.project) {
      setError(
        language === "en"
          ? data.error || t("couldNotLoadProject")
          : t("couldNotLoadProject"),
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
        language === "en"
          ? data.error || t("couldNotSaveProject")
          : t("couldNotSaveProject"),
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
        localize(language, {
          en: "Remove this item from the project? The original stays in your session.",
          ko: "이 항목을 프로젝트에서 제거할까요? 원본 대화/결과는 세션에 그대로 남습니다.",
          ja: "この項目をプロジェクトから削除しますか？元の会話/結果はセッションに残ります。",
          es: "¿Quitar este elemento del proyecto? El original permanece en tu sesión.",
        }),
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

  function openSessionRemoval(session: ProjectSession) {
    setSelectedSession(session);
    setRemovalStage("choose");
    setRemovalError("");
  }

  function closeSessionRemoval() {
    if (removalAction) return;
    setSelectedSession(null);
    setRemovalStage("choose");
    setRemovalError("");
  }

  async function performSessionRemoval(action: "unlink" | "permanent") {
    if (!selectedSession || removalAction) return;

    setRemovalAction(action);
    setRemovalError("");
    setError("");
    setNotice("");

    try {
      const endpoint =
        action === "unlink"
          ? `/api/projects/${projectId}/sessions/${selectedSession.id}`
          : `/api/sessions/${selectedSession.id}`;
      const response = await fetch(endpoint, { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setRemovalError(
          language === "en" ? data.error || removalText.failed : removalText.failed,
        );
        return;
      }

      setProject((current) =>
        current ? withoutProjectSession(current, selectedSession.id) : current,
      );
      setNotice(
        action === "unlink"
          ? removalText.unlinkSuccess
          : removalText.permanentSuccess,
      );
      setSelectedSession(null);
      setRemovalStage("choose");
    } catch {
      setRemovalError(removalText.failed);
    } finally {
      setRemovalAction(null);
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

  useEffect(() => {
    if (!selectedSession) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !removalAction) {
        setSelectedSession(null);
        setRemovalStage("choose");
        setRemovalError("");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedSession, removalAction]);

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
                ? localize(language, {
                    en: "Saving…",
                    ko: "저장 중…",
                    ja: "保存中…",
                    es: "Guardando…",
                  })
                : projectSavedAt
                  ? localize(language, {
                      en: "Saved ✓",
                      ko: "저장됨 ✓",
                      ja: "保存しました ✓",
                      es: "Guardado ✓",
                    })
                  : t("saveProject")}
            </button>
            <button
              type="button"
              onClick={deleteProject}
              disabled={deletingProject}
              className="rounded-md border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deletingProject
                ? localize(language, {
                    en: "Deleting…",
                    ko: "삭제 중…",
                    ja: "削除中…",
                    es: "Eliminando…",
                  })
                : t("deleteFolder")}
            </button>
          </div>
        </form>

        <section className="order-1 space-y-3 xl:order-2">
          <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-stone-950">
              {localize(language, {
                en: "Collected items",
                ko: "추가된 대화/결과",
                ja: "収集した項目",
                es: "Elementos recopilados",
              })}
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              {localize(language, {
                en: `${project.items.length} conversations and individual results added from your sessions. Originals stay in their sessions.`,
                ko: `세션에서 추가한 대화와 개별 결과 ${project.items.length}개. 원본은 세션에 그대로 남아 있습니다.`,
                ja: `セッションから追加した会話と個別の結果 ${project.items.length} 件。元はセッションに残ります。`,
                es: `${project.items.length} conversaciones y resultados individuales añadidos desde tus sesiones. Los originales permanecen en sus sesiones.`,
              })}
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
                            ? localize(language, {
                                en: "Single result",
                                ko: "단일 결과",
                                ja: "単一の結果",
                                es: "Resultado único",
                              })
                            : localize(language, {
                                en: "Full conversation",
                                ko: "대화 전체",
                                ja: "会話全体",
                                es: "Conversación completa",
                              })}
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
                          {localize(language, {
                            en: "From session",
                            ko: "출처 세션",
                            ja: "出典セッション",
                            es: "De la sesión",
                          })}
                          : {item.session.title}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-none flex-wrap gap-2">
                      {item.session ? (
                        <Link
                          href={`/app/workbench?session=${item.session.id}`}
                          className="flex-1 rounded-md bg-stone-950 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-stone-800 lg:flex-none"
                        >
                          {t("open")}
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="flex-1 rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 lg:flex-none"
                      >
                        {localize(language, {
                          en: "Remove",
                          ko: "제거",
                          ja: "削除",
                          es: "Quitar",
                        })}
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
                    <div className="grid w-full grid-cols-2 gap-2 lg:flex lg:w-auto lg:flex-none">
                      <Link
                        href={`/app/workbench?session=${session.id}`}
                        className="rounded-md bg-stone-950 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-stone-800"
                      >
                        {t("open")}
                      </Link>
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        onClick={() => openSessionRemoval(session)}
                        className="rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        {removalText.delete}
                      </button>
                    </div>
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

      {selectedSession ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-stone-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeSessionRemoval();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-session-removal-title"
            className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl"
          >
            <h2
              id="project-session-removal-title"
              className="text-lg font-semibold text-stone-950"
            >
              {removalStage === "choose"
                ? removalText.dialogTitle
                : removalText.confirmTitle}
            </h2>
            <p className="mt-2 break-words text-sm font-medium text-stone-800">
              {selectedSession.title}
            </p>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              {removalStage === "choose"
                ? removalText.chooseDescription
                : removalText.confirmDescription}
            </p>

            {removalError ? (
              <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {removalError}
              </div>
            ) : null}

            {removalStage === "choose" ? (
              <div className="mt-5 grid gap-3">
                <button
                  type="button"
                  autoFocus
                  disabled={!!removalAction}
                  onClick={() => performSessionRemoval("unlink")}
                  className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-left hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="block text-sm font-semibold text-teal-900">
                    {removalAction === "unlink"
                      ? removalText.unlinking
                      : removalText.unlink}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-teal-800">
                    {removalText.unlinkHelp}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={!!removalAction}
                  onClick={() => {
                    setRemovalStage("confirm-permanent");
                    setRemovalError("");
                  }}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-left hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="block text-sm font-semibold text-rose-900">
                    {removalText.permanent}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-rose-800">
                    {removalText.permanentHelp}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={!!removalAction}
                  onClick={closeSessionRemoval}
                  className="rounded-md border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-60"
                >
                  {removalText.cancel}
                </button>
              </div>
            ) : (
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={!!removalAction}
                  onClick={() => {
                    setRemovalStage("choose");
                    setRemovalError("");
                  }}
                  className="rounded-md border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-60"
                >
                  {removalText.back}
                </button>
                <button
                  type="button"
                  disabled={!!removalAction}
                  onClick={() => performSessionRemoval("permanent")}
                  className="rounded-md bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {removalAction === "permanent"
                    ? removalText.deleting
                    : removalText.confirm}
                </button>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
