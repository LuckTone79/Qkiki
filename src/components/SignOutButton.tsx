"use client";

import { useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  async function signOut() {
    setLoading(true);
    await fetch("/api/auth/sign-out", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={loading}
      className={
        compact
          ? "text-sm font-medium text-stone-600 hover:text-stone-950 disabled:opacity-60"
          : "rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60"
      }
    >
      {loading ? t("signingOut") : t("signOut")}
    </button>
  );
}
