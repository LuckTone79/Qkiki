"use client";

import { useLanguage } from "@/components/i18n/LanguageProvider";

type StatusBadgeProps = {
  status: string;
};

const styles: Record<string, string> = {
  ready: "border-emerald-200 bg-emerald-50 text-emerald-800",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  running: "border-cyan-200 bg-cyan-50 text-cyan-800",
  missing_key: "border-amber-200 bg-amber-50 text-amber-900",
  failed: "border-rose-200 bg-rose-50 text-rose-800",
  disabled: "border-stone-200 bg-stone-50 text-stone-600",
  saved: "border-teal-200 bg-teal-50 text-teal-800",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useLanguage();
  const label =
    status === "ready"
      ? t("statusReady")
      : status === "completed"
        ? t("statusCompleted")
        : status === "running"
          ? t("statusRunning")
          : status === "missing_key"
            ? t("statusMissingKey")
            : status === "failed"
              ? t("statusFailed")
              : status === "disabled"
                ? t("statusDisabled")
                : status === "saved"
                  ? t("statusSaved")
                  : status.replaceAll("_", " ");

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${
        styles[status] ?? "border-stone-200 bg-white text-stone-700"
      }`}
    >
      {label}
    </span>
  );
}
