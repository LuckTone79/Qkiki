"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { SectionHeader } from "@/components/SectionHeader";
import {
  localize,
  useLanguage,
  type AppLanguage,
} from "@/components/i18n/LanguageProvider";

type Preset = {
  id: string;
  name: string;
  description: string | null;
  workflowJson: string;
  updatedAt: string;
};

function actionLabel(value: string, language: AppLanguage) {
  const labels: Record<string, Record<AppLanguage, string>> = {
    generate: { en: "Generate", ko: "\uc0dd\uc131", ja: "\u751f\u6210", es: "Generar" },
    brainstorm: {
      en: "Brainstorm",
      ko: "\ube0c\ub808\uc778\uc2a4\ud1a0\ubc0d",
      ja: "\u30d6\u30ec\u30a4\u30f3\u30b9\u30c8\u30fc\u30df\u30f3\u30b0",
      es: "Lluvia de ideas",
    },
    critique: { en: "Critique", ko: "\ube44\ud310", ja: "\u6279\u8a55", es: "Cr\u00edtica" },
    fact_check: {
      en: "Fact-check style review",
      ko: "\ud329\ud2b8\uccb4\ud06c\uc2dd \uac80\ud1a0",
      ja: "\u30d5\u30a1\u30af\u30c8\u30c1\u30a7\u30c3\u30af\u5f62\u5f0f\u306e\u30ec\u30d3\u30e5\u30fc",
      es: "Revisi\u00f3n tipo verificaci\u00f3n",
    },
    improve: { en: "Improve", ko: "\uac1c\uc120", ja: "\u6539\u5584", es: "Mejorar" },
    summarize: { en: "Summarize", ko: "\uc694\uc57d", ja: "\u8981\u7d04", es: "Resumir" },
    simplify: {
      en: "Simplify",
      ko: "\uc27d\uac8c \uc815\ub9ac",
      ja: "\u7c21\u6f54\u5316",
      es: "Simplificar",
    },
    consistency_review: {
      en: "Consistency review",
      ko: "\uc77c\uad00\uc131 \uac80\ud1a0",
      ja: "\u4e00\u8cab\u6027\u30ec\u30d3\u30e5\u30fc",
      es: "Revisi\u00f3n de consistencia",
    },
    code_review: {
      en: "Code review",
      ko: "\ucf54\ub4dc \ub9ac\ubdf0",
      ja: "\u30b3\u30fc\u30c9\u30ec\u30d3\u30e5\u30fc",
      es: "Revisi\u00f3n de c\u00f3digo",
    },
  };

  return labels[value]?.[language] ?? value;
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
          const target = `${step.targetProvider}/${step.targetModel}`;
          return localize(language, {
            en: `${index + 1}. ${action} with ${target} from ${source}`,
            ko: `${index + 1}. ${source} -> ${target} ${action}`,
            ja: `${index + 1}. ${source} → ${target} ${action}`,
            es: `${index + 1}. ${action} con ${target} desde ${source}`,
          });
        })
        .join(" -> ") || t("noSteps")
    );
  } catch {
    return t("invalidWorkflowJson");
  }
}

export function PresetsClient() {
  const { language, t } = useLanguage();
  const [presets, setPresets] = useState<Preset[]>([]);
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
        language === "en"
          ? data.error || t("couldNotLoadPresets")
          : t("couldNotLoadPresets"),
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
    loadPresets();
    // Load presets once on entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
                <div className="flex flex-col gap-2 sm:min-w-72">
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
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => renamePreset(preset)}
                      disabled={renamingId === preset.id}
                      className={`rounded-md border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${renamedId === preset.id ? "border-teal-300 bg-teal-50 text-teal-700" : "border-stone-300 text-stone-700 hover:bg-stone-50"}`}
                    >
                      {renamingId === preset.id
                        ? localize(language, {
                            en: "Saving…",
                            ko: "저장 중…",
                            ja: "保存中…",
                            es: "Guardando…",
                          })
                        : renamedId === preset.id
                          ? localize(language, {
                              en: "Saved ✓",
                              ko: "저장됨 ✓",
                              ja: "保存しました ✓",
                              es: "Guardado ✓",
                            })
                          : t("rename")}
                    </button>
                    <Link
                      href={`/app/workbench?preset=${preset.id}`}
                      className="rounded-md bg-stone-950 px-3 py-2 text-sm font-semibold text-white hover:bg-stone-800"
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
