"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const text = {
  en: {
    newPassword: "New password",
    confirmPassword: "Confirm password",
    submit: "Update password",
    updating: "Updating...",
    mismatch: "Passwords do not match.",
    genericError: "Could not update your password. Please try again.",
    invalidLink: "This reset link is invalid or has expired.",
    requestNewLink: "Request a new reset link",
    success: "Password updated. Redirecting...",
  },
  ko: {
    newPassword: "새 비밀번호",
    confirmPassword: "비밀번호 확인",
    submit: "비밀번호 변경",
    updating: "변경 중...",
    mismatch: "비밀번호가 일치하지 않습니다.",
    genericError: "비밀번호를 변경하지 못했습니다. 다시 시도해주세요.",
    invalidLink: "재설정 링크가 유효하지 않거나 만료되었습니다.",
    requestNewLink: "재설정 링크 다시 받기",
    success: "비밀번호가 변경되었습니다. 이동 중...",
  },
} as const;

export function ResetPasswordForm() {
  const { language } = useLanguage();
  const t = text[language === "ko" ? "ko" : "en"];
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session));
    });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(t.mismatch);
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(t.genericError);
      return;
    }

    setSuccess(true);
    window.setTimeout(() => {
      window.location.href = "/app/workbench";
    }, 1200);
  }

  if (hasSession === false) {
    return (
      <div className="space-y-4">
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {t.invalidLink}
        </p>
        <Link
          href="/forgot-password"
          className="inline-block text-sm font-semibold text-teal-700 hover:text-teal-900"
        >
          {t.requestNewLink}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-stone-700">{t.newPassword}</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-stone-700">{t.confirmPassword}</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
        />
      </label>

      {success ? (
        <p className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {t.success}
        </p>
      ) : error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading || success || hasSession !== true}
        className="w-full rounded-md bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-60"
      >
        {loading ? t.updating : t.submit}
      </button>
    </form>
  );
}
