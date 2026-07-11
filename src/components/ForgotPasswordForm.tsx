"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const text = {
  en: {
    email: "Email",
    submit: "Send reset link",
    sending: "Sending...",
    sentTitle: "Check your email",
    sentDescription:
      "If an account exists for that address, a password reset link is on its way.",
    backToSignIn: "Back to sign in",
    genericError: "Could not send the reset link. Please try again.",
  },
  ko: {
    email: "이메일",
    submit: "재설정 링크 보내기",
    sending: "전송 중...",
    sentTitle: "이메일을 확인해주세요",
    sentDescription:
      "해당 주소로 계정이 있다면 비밀번호 재설정 링크가 곧 도착합니다.",
    backToSignIn: "로그인으로 돌아가기",
    genericError: "재설정 링크를 보내지 못했습니다. 다시 시도해주세요.",
  },
} as const;

export function ForgotPasswordForm() {
  const { language } = useLanguage();
  const t = text[language === "ko" ? "ko" : "en"];
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);
  const captchaRequired = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { error: submitError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        captchaToken: turnstileToken || undefined,
      },
    );

    setTurnstileToken("");
    setTurnstileResetSignal((value) => value + 1);
    setLoading(false);

    if (submitError) {
      setError(t.genericError);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-semibold text-stone-900">{t.sentTitle}</p>
        <p className="text-sm leading-6 text-stone-600">{t.sentDescription}</p>
        <Link
          href="/sign-in"
          className="inline-block text-sm font-semibold text-teal-700 hover:text-teal-900"
        >
          {t.backToSignIn}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-stone-700">{t.email}</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
          placeholder="you@example.com"
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
        className="w-full rounded-md bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-60"
      >
        {loading ? t.sending : t.submit}
      </button>

      <p className="text-center text-sm text-stone-600">
        <Link href="/sign-in" className="font-semibold text-teal-700 hover:text-teal-900">
          {t.backToSignIn}
        </Link>
      </p>
    </form>
  );
}
