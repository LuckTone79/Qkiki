"use client";

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
  const ko = language === "ko";

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
        ? ko
          ? "이미 추가된 항목입니다."
          : "Already in the project."
        : ko
          ? "프로젝트에 추가되었습니다."
          : "Added to the project.",
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
        result.error || (ko ? "추가하지 못했습니다." : "Could not add."),
      );
    }
  }

  async function createAndAdd() {
    const name = newName.trim().slice(0, MAX_PROJECT_NAME);
    if (!name) {
      setStatus("error");
      setMessage(ko ? "프로젝트 이름을 입력하세요." : "Enter a project name.");
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
        data.error || (ko ? "프로젝트를 만들지 못했습니다." : "Could not create project."),
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
        result.error || (ko ? "추가하지 못했습니다." : "Could not add."),
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
        {label || (ko ? "프로젝트에 추가" : "Add to project")}
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
                {ko ? "프로젝트에 추가" : "Add to project"}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={ko ? "닫기" : "Close"}
                className="flex h-7 w-7 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                {ko ? "새 프로젝트로 추가" : "Add to a new project"}
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  maxLength={MAX_PROJECT_NAME}
                  placeholder={ko ? "새 프로젝트 이름" : "New project name"}
                  className="min-w-0 flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
                />
                <button
                  type="button"
                  disabled={busy || !newName.trim()}
                  onClick={createAndAdd}
                  className="flex-none rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
                >
                  {ko ? "만들어 추가" : "Create & add"}
                </button>
              </div>

              <div className="my-4 flex items-center gap-2 text-xs text-stone-400">
                <span className="h-px flex-1 bg-stone-200" />
                {ko ? "또는 기존 프로젝트 선택" : "or pick an existing project"}
                <span className="h-px flex-1 bg-stone-200" />
              </div>

              {loading ? (
                <p className="py-2 text-sm text-stone-500">
                  {ko ? "불러오는 중..." : "Loading..."}
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
                  {ko
                    ? "기존 프로젝트가 없습니다. 위에서 새로 만들어 추가하세요."
                    : "No projects yet. Create one above."}
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
