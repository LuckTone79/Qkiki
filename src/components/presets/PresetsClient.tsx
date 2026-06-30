"use client";

import { type AppLanguage } from "@/lib/i18n";

import { localize } from "@/lib/i18n";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { SectionHeader } from "@/components/SectionHeader";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { getActionTypeDisplayLabel } from "@/lib/ai/action-display";
import { ACTION_TYPES } from "@/lib/ai/types";

type Preset = {
  id: string;
  name: string;
  description: string | null;
  workflowJson: string;
  updatedAt: string;
};

type PresetsClientProps = {
  initialPresets?: Preset[];
  initialLoaded?: boolean;
};

function actionLabel(value: string, language: AppLanguage) {
  const actionType = ACTION_TYPES.find((candidate) => candidate === value);
  return actionType ? getActionTypeDisplayLabel(actionType, language) : value;
}

function sourceLabel(
  value: string,
  t: ReturnType<typeof useLanguage>["t"],
) {
  if (value === "previous") {
    return t("previousStep");
  }
  if (value === "selected_result") {
    return t("selectedResult");
  }
  if (value === "all_results") {
    return t("allCurrentResults");
  }
  return t("originalInput");
}

function stepPreview(
  workflowJson: string,
  language: AppLanguage,
  t: ReturnType<typeof useLanguage>["t"],
) {
  try {
    const parsed = JSON.parse(workflowJson) as {
      steps?: Array<{
        actionType: string;
        targetProvider: string;
        targetModel: string;
        sourceMode: string;
      }>;
    };

    return (
      parsed.steps
        ?.map((step, index) => {
          const action = actionLabel(step.actionType, language);
          const source = sourceLabel(step.sourceMode, t);
          return localize(language, { en: `${index + 1}. ${action} with ${step.targetProvider}/${step.targetModel} from ${source}`, ko: `${index + 1}. ${source} -> ${step.targetProvider}/${step.targetModel} ${action}`, ja: `${index + 1}. ${action}\u3068${step.targetProvider}/${step.targetModel}\u304B\u3089${source}`, es: `${index + 1}. ${action}con${step.targetProvider}/${step.targetModel}de${source}` });
        })
        .join(" -> ") || t("noSteps")
    );
  } catch {
    return t("invalidWorkflowJson");
  }
}

export function PresetsClient({
  initialPresets = [],
  initialLoaded = false,
}: PresetsClientProps = {}) {
  const { language, t } = useLanguage();
  const [presets, setPresets] = useState<Preset[]>(initialPresets);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamedId, setRenamedId] = useState<string | null>(null);
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);

  async function loadPresets() {
    const response = await fetch("/api/presets");
    const data = (await response.json().catch(() => ({}))) as {
      presets?: Preset[];
      error?: string;
    };

    if (!response.ok || !data.presets) {
      setError(
        localize(language, { en: data.error || t("couldNotLoadPresets"), ko: t("couldNotLoadPresets"), ja: data.error || t("couldNotLoadPresets"), es: data.error || t("couldNotLoadPresets") }),
      );
      return;
    }

    setPresets(data.presets);
  }

  async function renamePreset(preset: Preset) {
    const name = editing[preset.id]?.trim();
    if (!name || renamingId) {
      return;
    }

    setRenamingId(preset.id);
    try {
      const response = await fetch(`/api/presets/${preset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (response.ok) {
        await loadPresets();
        setEditing((current) => ({ ...current, [preset.id]: "" }));
        setRenamedId(preset.id);
        setTimeout(() => setRenamedId(null), 1500);
      }
    } finally {
      setRenamingId(null);
    }
  }

  async function deletePreset(id: string) {
    if (!window.confirm(t("deletePresetConfirm"))) {
      return;
    }

    setDeletingPresetId(id);
    try {
      const response = await fetch(`/api/presets/${id}`, { method: "DELETE" });
      if (response.ok) {
        setPresets((current) => current.filter((preset) => preset.id !== id));
      }
    } finally {
      setDeletingPresetId(null);
    }
  }

  const hasPresets = useMemo(() => presets.length > 0, [presets]);

  useEffect(() => {
    if (initialLoaded) return;
    loadPresets();
    // Load presets once on entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLoaded]);

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow={t("presets")}
        title={t("reusableWorkflowRoutes")}
        description={t("presetsDescriptionFull")}
        action={
          <Link
            href="/app/workbench"
            className="rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
          >
            {t("openWorkbench")}
          </Link>
        }
      />

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {hasPresets ? (
        <div className="grid gap-3">
          {presets.map((preset) => (
            <article
              key={preset.id}
              className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-stone-950">
                    {preset.name}
                  </h2>
                  <p className="mt-1 text-sm text-stone-600">
                    {preset.description || t("noDescription")}
                  </p>
                  <p className="mt-3 max-w-4xl text-xs leading-5 text-stone-500">
                    {stepPreview(preset.workflowJson, language, t)}
                  </p>
                </div>
                <div className="flex min-w-0 flex-col gap-2 sm:min-w-72">
                  <input
                    value={editing[preset.id] ?? ""}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        [preset.id]: event.target.value,
                      })
                    }
                    className="rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
                    placeholder={t("renamePreset")}
                  />
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <button
                      type="button"
                      onClick={() => renamePreset(preset)}
                      disabled={renamingId === preset.id}
                      className={`col-span-2 rounded-md border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-1 ${renamedId === preset.id ? "border-teal-300 bg-teal-50 text-teal-700" : "border-stone-300 text-stone-700 hover:bg-stone-50"}`}
                    >
                      {renamingId === preset.id
                        ? (localize(language, { en: "Saving…", ko: "저장 중…", ja: "\u4FDD\u5B58\u4E2D\u2026", es: "Guardando\u2026" }))
                        : renamedId === preset.id
                          ? (localize(language, { en: "Saved ✓", ko: "저장됨 ✓", ja: "\u4FDD\u5B58\u6E08\u307F \u2713", es: "Guardado \u2713" }))
                          : t("rename")}
                    </button>
                    <Link
                      href={`/app/workbench?preset=${preset.id}`}
                      className="rounded-md bg-stone-950 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-stone-800"
                    >
                      {t("load")}
                    </Link>
                    <button
                      type="button"
                      onClick={() => deletePreset(preset.id)}
                      disabled={deletingPresetId === preset.id}
                      className="rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingPresetId === preset.id
                        ? (localize(language, { en: "Deleting…", ko: "삭제 중…", ja: "\u524A\u9664\u4E2D\u2026", es: "Eliminando\u2026" }))
                        : t("delete")}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title={t("noPresetsSaved")}
          description={t("noPresetsDescription")}
        />
      )}
    </div>
  );
}
