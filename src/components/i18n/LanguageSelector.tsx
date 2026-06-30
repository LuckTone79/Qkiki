"use client";

import { normalizeAppLanguage } from "@/lib/i18n";

import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();
  const pathname = usePathname();
  const isShellRoute =
    pathname?.startsWith("/app") ||
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/shared/");

  if (pathname === "/guide/global-monetization") {
    return null;
  }

  return (
    <label
      className={`fixed z-50 items-center gap-2 rounded-md border border-stone-200 bg-white/95 px-2.5 py-2 text-[11px] font-medium text-stone-600 shadow-sm backdrop-blur sm:px-3 sm:text-xs ${
        isShellRoute
          ? "hidden sm:flex sm:right-4 sm:top-4"
          : "flex bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-3 sm:bottom-auto sm:right-4 sm:top-4"
      }`}
    >
      <span>{t("language")}</span>
      <select
        value={language}
        onChange={(event) => setLanguage(normalizeAppLanguage(event.target.value))}
        className="rounded-md border border-stone-200 bg-white px-2 py-1 text-xs text-stone-700 outline-none focus:border-stone-900"
        aria-label={t("language")}
      >
        <option value="en">{t("english")}</option>
        <option value="ko">{t("korean")}</option>
        <option value="ja">{t("japanese")}</option>
        <option value="es">{t("spanish")}</option>
      </select>
    </label>
  );
}
