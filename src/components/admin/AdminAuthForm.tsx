"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";

const authText = {
  en: {
    email: "Email",
    password: "Password",
    mfaCode: "MFA code",
    mfaPlaceholder: "Enter MFA code",
    signIn: "Sign in as admin",
    signingIn: "Signing in...",
    fallbackError: "Admin sign-in failed.",
    backToUser: "Back to user app?",
    userSignIn: "User sign-in",
  },
  ko: {
    email: "\uC774\uBA54\uC77C",
    password: "\uBE44\uBC00\uBC88\uD638",
    mfaCode: "MFA \uCF54\uB4DC",
    mfaPlaceholder: "MFA \uCF54\uB4DC\uB97C \uC785\uB825\uD558\uC138\uC694",
    signIn: "\uAD00\uB9AC\uC790 \uB85C\uADF8\uC778",
    signingIn: "\uB85C\uADF8\uC778 \uC911...",
    fallbackError:
      "\uAD00\uB9AC\uC790 \uB85C\uADF8\uC778\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.",
    backToUser:
      "\uC0AC\uC6A9\uC790 \uD654\uBA74\uC73C\uB85C \uB3CC\uC544\uAC00\uAE30?",
    userSignIn: "\uC0AC\uC6A9\uC790 \uB85C\uADF8\uC778",
  },
} as const;

export function AdminAuthForm() {
  const { language } = useLanguage();
  const t = authText[language];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const response = await fetch("/api/admin/auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, mfaCode }),
    });

    const data = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setError(data.error || t.fallbackError);
      setLoading(false);
      return;
    }

    window.location.href = "/admin";
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-slate-700">{t.email}</span>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-700"
          placeholder="admin@example.com"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">{t.password}</span>
        <input
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-700"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">{t.mfaCode}</span>
        <input
          type="password"
          required
          value={mfaCode}
          onChange={(event) => setMfaCode(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-700"
          placeholder={t.mfaPlaceholder}
        />
      </label>

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {loading ? t.signingIn : t.signIn}
      </button>

      <p className="text-center text-sm text-slate-600">
        {t.backToUser}{" "}
        <Link href="/sign-in" className="font-semibold text-slate-900 hover:text-slate-700">
          {t.userSignIn}
        </Link>
      </p>
    </form>
  );
}
