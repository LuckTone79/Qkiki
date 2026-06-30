"use client";

import { localize } from "@/lib/i18n";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type ProjectOption = { id: string; name: string };

type AddPayload = {
  kind: "SESSION" | "RESULT";
  sessionId: string;
  resultId?: string;
  title?: string;
};

const MAX_PROJECT_NAME = 120;

export function AddToProjectButton({
  payload,
  className,
  label,
}: {
  payload: AddPayload;
  className?: string;
  label?: string;
}) {
  const { language } = useLanguage();

  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setStatus("idle");
    setMessage("");
    setNewName((payload.title || "").slice(0, MAX_PROJECT_NAME));

    if (projects === null) {
      setLoading(true);
      fetch("/api/projects")
        .then(async (response) => {
          const data = (await response.json().catch(() => ({}))) as {
            projects?: ProjectOption[];
          };
          setProjects(
            response.ok && data.projects
              ? data.projects.map((project) => ({
                  id: project.id,
                  name: project.name,
                }))
              : [],
          );
        })
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function addItem(projectId: string) {
    const response = await fetch(`/api/projects/${projectId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
    };
    if (response.ok) {
      return { ok: true };
    }
    if (data.code === "ALREADY_ADDED") {
      return { ok: true, already: true };
    }
    return { ok: false, error: data.error };
  }

  function finishSuccess(already?: boolean) {
    setStatus("done");
    setMessage(
      already
        ? localize(language, { en: "Already in the project.", ko: "이미 추가된 항목입니다.", ja: "\u3059\u3067\u306B\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u306B\u5165\u3063\u3066\u3044\u307E\u3059\u3002", es: "Ya en el proyecto." })
        : localize(language, { en: "Added to the project.", ko: "프로젝트에 추가되었습니다.", ja: "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u306B\u8FFD\u52A0\u3055\u308C\u307E\u3057\u305F\u3002", es: "Agregado al proyecto." }),
    );
    window.setTimeout(() => setOpen(false), 900);
  }

  async function addToExisting(projectId: string) {
    setBusy(true);
    setMessage("");
    const result = await addItem(projectId);
    setBusy(false);
    if (result.ok) {
      finishSuccess(result.already);
    } else {
      setStatus("error");
      setMessage(
        result.error || (localize(language, { en: "Could not add.", ko: "추가하지 못했습니다.", ja: "\u8FFD\u52A0\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002", es: "No se pudo agregar." })),
      );
    }
  }

  async function createAndAdd() {
    const name = newName.trim().slice(0, MAX_PROJECT_NAME);
    if (!name) {
      setStatus("error");
      setMessage(localize(language, { en: "Enter a project name.", ko: "프로젝트 이름을 입력하세요.", ja: "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u540D\u3092\u5165\u529B\u3057\u307E\u3059\u3002", es: "Introduzca un nombre de proyecto." }));
      return;
    }
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      project?: { id: string };
      error?: string;
    };
    if (!response.ok || !data.project) {
      setBusy(false);
      setStatus("error");
      setMessage(
        data.error || (localize(language, { en: "Could not create project.", ko: "프로젝트를 만들지 못했습니다.", ja: "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u3092\u4F5C\u6210\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002", es: "No se pudo crear el proyecto." })),
      );
      return;
    }
    const result = await addItem(data.project.id);
    setBusy(false);
    if (result.ok) {
      finishSuccess(result.already);
    } else {
      setStatus("error");
      setMessage(
        result.error || (localize(language, { en: "Could not add.", ko: "추가하지 못했습니다.", ja: "\u8FFD\u52A0\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002", es: "No se pudo agregar." })),
      );
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          "min-h-10 rounded-md border border-indigo-300 px-3 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-50"
        }
      >
        {label || (localize(language, { en: "Add to project", ko: "프로젝트에 추가", ja: "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u306B\u8FFD\u52A0", es: "A\u00F1adir al proyecto" }))}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
              <h2 className="text-base font-semibold text-stone-950">
                {localize(language, { en: "Add to project", ko: "프로젝트에 추가", ja: "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u306B\u8FFD\u52A0", es: "A\u00F1adir al proyecto" })}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={localize(language, { en: "Close", ko: "닫기", ja: "\u9589\u3058\u308B", es: "Cerrar" })}
                className="flex h-7 w-7 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                {localize(language, { en: "Add to a new project", ko: "새 프로젝트로 추가", ja: "\u65B0\u3057\u3044\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u306B\u8FFD\u52A0\u3059\u308B", es: "Agregar a un nuevo proyecto" })}
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  maxLength={MAX_PROJECT_NAME}
                  placeholder={localize(language, { en: "New project name", ko: "새 프로젝트 이름", ja: "\u65B0\u3057\u3044\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u540D", es: "Nuevo nombre del proyecto" })}
                  className="min-w-0 flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
                />
                <button
                  type="button"
                  disabled={busy || !newName.trim()}
                  onClick={createAndAdd}
                  className="flex-none rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
                >
                  {localize(language, { en: "Create & add", ko: "만들어 추가", ja: "\u4F5C\u6210\u3068\u8FFD\u52A0", es: "Crear y agregar" })}
                </button>
              </div>

              <div className="my-4 flex items-center gap-2 text-xs text-stone-400">
                <span className="h-px flex-1 bg-stone-200" />
                {localize(language, { en: "or pick an existing project", ko: "또는 기존 프로젝트 선택", ja: "\u307E\u305F\u306F\u65E2\u5B58\u306E\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u3092\u9078\u629E\u3057\u307E\u3059", es: "o elegir un proyecto existente" })}
                <span className="h-px flex-1 bg-stone-200" />
              </div>

              {loading ? (
                <p className="py-2 text-sm text-stone-500">
                  {localize(language, { en: "Loading...", ko: "불러오는 중...", ja: "\u8AAD\u307F\u8FBC\u307F\u4E2D...", es: "Cargando..." })}
                </p>
              ) : projects && projects.length > 0 ? (
                <ul className="space-y-1">
                  {projects.map((project) => (
                    <li key={project.id}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => addToExisting(project.id)}
                        className="block w-full truncate rounded-md border border-stone-200 px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-60"
                      >
                        {project.name}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-2 text-sm text-stone-500">
                  {localize(language, { en: "No projects yet. Create one above.", ko: "기존 프로젝트가 없습니다. 위에서 새로 만들어 추가하세요.", ja: "\u307E\u3060\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u306F\u3042\u308A\u307E\u305B\u3093\u3002\u4E0A\u306B\u4F5C\u6210\u3057\u307E\u3059\u3002", es: "A\u00FAn no hay proyectos. Crea uno arriba." })}
                </p>
              )}

              {message ? (
                <p
                  className={`mt-3 text-sm ${
                    status === "error" ? "text-rose-600" : "text-teal-700"
                  }`}
                >
                  {message}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
