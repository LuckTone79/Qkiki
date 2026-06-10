"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type ProjectOption = { id: string; name: string };

type AddPayload = {
  kind: "SESSION" | "RESULT";
  sessionId: string;
  resultId?: string;
  title?: string;
};

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
  const containerRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    setMessage("");
    setStatus("idle");
    if (next && projects === null) {
      setLoading(true);
      const response = await fetch("/api/projects");
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
      setLoading(false);
    }
  }

  async function addToProject(projectId: string) {
    setStatus("saving");
    setMessage("");
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
      setStatus("done");
      setMessage(ko ? "프로젝트에 추가되었습니다." : "Added to the project.");
      return;
    }

    if (data.code === "ALREADY_ADDED") {
      setStatus("done");
      setMessage(ko ? "이미 추가된 항목입니다." : "Already in the project.");
      return;
    }

    setStatus("error");
    setMessage(
      data.error || (ko ? "추가하지 못했습니다." : "Could not add to project."),
    );
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={toggleOpen}
        className={
          className ||
          "min-h-10 rounded-md border border-indigo-300 px-3 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-50"
        }
      >
        {label || (ko ? "프로젝트에 추가" : "Add to project")}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-1 w-64 rounded-md border border-stone-200 bg-white p-2 text-left shadow-lg">
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-stone-400">
            {ko ? "프로젝트 선택" : "Choose a project"}
          </p>

          {loading ? (
            <p className="px-2 py-2 text-sm text-stone-500">
              {ko ? "불러오는 중..." : "Loading..."}
            </p>
          ) : projects && projects.length > 0 ? (
            <ul className="max-h-60 overflow-y-auto">
              {projects.map((project) => (
                <li key={project.id}>
                  <button
                    type="button"
                    disabled={status === "saving"}
                    onClick={() => addToProject(project.id)}
                    className="block w-full truncate rounded-md px-2 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-100 disabled:opacity-60"
                  >
                    {project.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2 py-2 text-sm text-stone-500">
              {ko
                ? "먼저 프로젝트를 만들어 주세요."
                : "Create a project first."}
            </p>
          )}

          {message ? (
            <p
              className={`mt-1 px-2 py-1 text-xs ${
                status === "error" ? "text-rose-600" : "text-teal-700"
              }`}
            >
              {message}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
