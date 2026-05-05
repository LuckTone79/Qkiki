"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { SectionHeader } from "@/components/SectionHeader";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type Preset = {
  id: string;
  name: string;
  description: string | null;
  workflowJson: string;
  updatedAt: string;
};

function actionLabel(value: string, language: "en" | "ko") {
  const labels: Record<string, { en: string; ko: string }> = {
    generate: { en: "Generate", ko: "\uc0dd\uc131" },
    critique: { en: "Critique", ko: "\ube44\ud310" },
    fact_check: {
      en: "Fact-check style review",
      ko: "\ud329\ud2b8\uccb4\ud06c\uc2dd \uac80\ud1a0",
    },
    improve: { en: "Improve", ko: "\uac1c\uc120" },
    summarize: { en: "Summarize", ko: "\uc694\uc57d" },
    simplify: { en: "Simplify", ko: "\uc27d\uac8c \uc815\ub9ac" },
    consistency_review: {
      en: "Consistency review",
      ko: "\uc77c\uad00\uc131 \uac80\ud1a0",
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
  language: "en" | "ko",
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
          return language === "ko"
            ? `${index + 1}. ${source} -> ${step.targetProvider}/${step.targetModel} ${action}`
            : `${index + 1}. ${action} with ${step.targetProvider}/${step.targetModel} from ${source}`;
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

  async function loadPresets() {
    const response = await fetch("/api/presets");
    const data = (await response.json().catch(() => ({}))) as {
      presets?: Preset[];
      error?: string;
    };

    if (!response.ok || !data.presets) {
      setError(
        language === "ko"
          ? t("couldNotLoadPresets")
          : data.error || t("couldNotLoadPresets"),
      );
      return;
    }

    setPresets(data.presets);
  }

  async function renamePreset(preset: Preset) {
    const name = editing[preset.id]?.trim();
    if (!name) {
      return;
    }

    const response = await fetch(`/api/presets/${preset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (response.ok) {
      await loadPresets();
      setEditing((current) => ({ ...current, [preset.id]: "" }));
    }
  }

  async function deletePreset(id: string) {
    if (!window.confirm(t("deletePresetConfirm"))) {
      return;
    }

    const response = await fetch(`/api/presets/${id}`, { method: "DELETE" });
    if (response.ok) {
      setPresets((current) => current.filter((preset) => preset.id !== id));
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
                      className="rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
                    >
                      {t("rename")}
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
                      className="rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      {t("delete")}
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
