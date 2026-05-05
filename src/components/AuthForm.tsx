"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type AuthFormProps = {
  mode: "sign-in" | "sign-up";
};

function sanitizeNextPath(candidate: string | null | undefined) {
  if (!candidate) {
    return "/app/workbench";
  }
  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return "/app/workbench";
  }
  if (!candidate.startsWith("/app")) {
    return "/app/workbench";
  }
  return candidate;
}

function getOAuthErrorMessage(errorCode: string | null, language: "en" | "ko") {
  if (!errorCode) {
    return "";
  }

  if (errorCode === "google_not_configured") {
    return language === "ko"
      ? "\uad6c\uae00 \ub85c\uadf8\uc778 \uc124\uc815\uc774 \uc644\ub8cc\ub418\uc9c0 \uc54a\uc558\uc2b5\ub2c8\ub2e4. \uad00\ub9ac\uc790\uc5d0\uac8c \ubb38\uc758\ud574\uc8fc\uc138\uc694."
      : "Google sign-in is not configured yet. Contact your administrator.";
  }

  if (errorCode === "account_suspended") {
    return language === "ko"
      ? "\uacc4\uc815\uc774 \uc815\uc9c0\ub418\uc5b4 \ub85c\uadf8\uc778\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4."
      : "Your account is suspended.";
  }

  return language === "ko"
    ? "\uad6c\uae00 \ub85c\uadf8\uc778\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4. \ub2e4\uc2dc \uc2dc\ub3c4\ud574\uc8fc\uc138\uc694."
    : "Google sign-in failed. Please try again.";
}

export function AuthForm({ mode }: AuthFormProps) {
  const { language, t } = useLanguage();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [nextPath, setNextPath] = useState("/app/workbench");
  const [oauthErrorCode, setOauthErrorCode] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(sanitizeNextPath(params.get("next")));
    setOauthErrorCode(params.get("error"));
  }, []);

  const oauthError = getOAuthErrorMessage(oauthErrorCode, language);
  const googleCta =
    language === "ko" ? "\uad6c\uae00\ub85c \uacc4\uc18d\ud558\uae30" : "Continue with Google";
  const dividerText = language === "ko" ? "\ub610\ub294 \uc774\uba54\uc77c\ub85c" : "or with email";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const payload =
      mode === "sign-up"
        ? {
            name: String(formData.get("name") || ""),
            email: String(formData.get("email") || ""),
            password: String(formData.get("password") || ""),
            confirmPassword: String(formData.get("confirmPassword") || ""),
          }
        : {
            email: String(formData.get("email") || ""),
            password: String(formData.get("password") || ""),
          };

    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setError(language === "ko" ? t("authFailed") : data.error || t("authFailed"));
      setLoading(false);
      return;
    }

    window.location.href = nextPath;
  }

  const isSignUp = mode === "sign-up";

  return (
    <form onSubmit={submit} className="space-y-4">
      {isSignUp ? (
        <label className="block">
          <span className="text-sm font-medium text-stone-700">
            {t("name")}
          </span>
          <input
            name="name"
            autoComplete="name"
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
            placeholder="Ada Lovelace"
          />
        </label>
      ) : null}

      <label className="block">
        <span className="text-sm font-medium text-stone-700">
          {t("email")}
        </span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
          placeholder="you@example.com"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-stone-700">
          {t("password")}
        </span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={isSignUp ? "new-password" : "current-password"}
          className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
        />
      </label>

      {isSignUp ? (
        <label className="block">
          <span className="text-sm font-medium text-stone-700">
            {t("confirmPassword")}
          </span>
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
          />
        </label>
      ) : null}

      <a
        href={`/api/auth/google/start?next=${encodeURIComponent(nextPath)}`}
        className="block w-full rounded-md border border-stone-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-stone-800 hover:bg-stone-50"
      >
        {googleCta}
      </a>

      <p className="text-center text-xs font-medium uppercase tracking-wide text-stone-500">
        {dividerText}
      </p>

      {error || oauthError ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error || oauthError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-60"
      >
        {loading ? t("working") : isSignUp ? t("createAccount") : t("signIn")}
      </button>

      <p className="text-center text-sm text-stone-600">
        {isSignUp ? t("alreadyHaveAccount") : t("newToMultiAi")}{" "}
        <Link
          href={isSignUp ? "/sign-in" : "/sign-up"}
          className="font-semibold text-teal-700 hover:text-teal-900"
        >
          {isSignUp ? t("signIn") : t("createAccount")}
        </Link>
      </p>
    </form>
  );
}
