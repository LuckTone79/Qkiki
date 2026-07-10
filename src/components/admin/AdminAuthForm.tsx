"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { TurnstileWidget } from "@/components/TurnstileWidget";

const authText = {
  en: {
    email: "Email",
    password: "Password",
    signIn: "Sign in as admin",
    signingIn: "Signing in...",
    fallbackError: "Admin sign-in failed.",
    backToUser: "Back to user app?",
    userSignIn: "User sign-in",
  },
  ko: {
    email: "이메일",
    password: "비밀번호",
    signIn: "관리자 로그인",
    signingIn: "로그인 중...",
    fallbackError:
      "관리자 로그인에 실패했습니다.",
    backToUser:
      "사용자 화면으로 돌아가기?",
    userSignIn: "사용자 로그인",
  },
} as const;

export function AdminAuthForm() {
  const { language } = useLanguage();
  const t = authText[language];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);
  const captchaRequired = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const response = await fetch("/api/admin/auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, captchaToken: turnstileToken || undefined }),
    });

    setTurnstileToken("");
    setTurnstileResetSignal((value) => value + 1);

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

      <TurnstileWidget
        onVerify={setTurnstileToken}
        onExpire={() => setTurnstileToken("")}
        resetSignal={turnstileResetSignal}
      />

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading || (captchaRequired && !turnstileToken)}
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
