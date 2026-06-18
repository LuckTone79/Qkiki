"use client";

import Link from "next/link";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export function AuthEntryLinks({ compact = false }: { compact?: boolean }) {
  const { t } = useLanguage();

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/sign-in"
          className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 hover:text-stone-950"
        >
          {t("signIn")}
        </Link>
        <Link
          href="/sign-up"
          className="rounded-md bg-stone-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-stone-800"
        >
          {t("createAccount")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <Link
        href="/sign-in"
        className="rounded-md border border-stone-300 bg-white px-3 py-2 text-center text-sm font-medium text-stone-700 hover:bg-stone-50 hover:text-stone-950"
      >
        {t("signIn")}
      </Link>
      <Link
        href="/sign-up"
        className="rounded-md bg-stone-900 px-3 py-2 text-center text-sm font-medium text-white hover:bg-stone-800"
      >
        {t("createAccount")}
      </Link>
    </div>
  );
}
