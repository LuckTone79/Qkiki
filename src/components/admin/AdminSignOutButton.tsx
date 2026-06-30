"use client";

import { withAdditionalLanguages } from "@/lib/i18n";

import { useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";

const text = withAdditionalLanguages({
  en: { signOut: "Sign out", signingOut: "Signing out..." },
  ko: { signOut: "로그아웃", signingOut: "로그아웃 중..." },
});

export function AdminSignOutButton({ compact = false }: { compact?: boolean }) {
  const { language } = useLanguage();
  const t = text[language];
  const [loading, setLoading] = useState(false);

  async function signOut() {
    if (loading) {
      return;
    }
    setLoading(true);
    await fetch("/api/admin/auth/sign-out", { method: "POST" });
    window.location.href = "/admin/sign-in";
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={loading}
      className={
        compact
          ? "rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          : "rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
      }
    >
      {loading ? t.signingOut : t.signOut}
    </button>
  );
}
