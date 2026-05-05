"use client";

import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();
  usePathname();

  return (
    <label className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-3 z-50 flex items-center gap-2 rounded-md border border-stone-200 bg-white/95 px-2.5 py-2 text-[11px] font-medium text-stone-700 shadow-sm backdrop-blur sm:bottom-auto sm:right-4 sm:top-4 sm:px-3 sm:text-xs">
      <span>{t("language")}</span>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value === "ko" ? "ko" : "en")}
        className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs outline-none focus:border-teal-600"
        aria-label={t("language")}
      >
        <option value="en">{t("english")}</option>
        <option value="ko">{t("korean")}</option>
      </select>
    </label>
  );
}
