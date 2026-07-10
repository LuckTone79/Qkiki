"use client";

import Link from "next/link";
import { FormEvent, MouseEvent, useEffect, useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { sanitizeNextPath } from "@/lib/auth-next-path";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  buildOpenInBrowserPath,
  isLikelyEmbeddedBrowser,
} from "@/lib/browser-detection";

type AuthFormProps = {
  mode: "sign-in" | "sign-up";
};

function getOAuthErrorMessage(errorCode: string | null, language: "en" | "ko") {
  if (!errorCode) {
    return "";
  }

  if (errorCode === "oauth_failed") {
    return language === "ko"
      ? "소셜 로그인에 실패했습니다. 다시 시도해주세요."
      : "Social sign-in failed. Please try again.";
  }

  if (errorCode === "account_suspended") {
    return language === "ko"
      ? "계정이 정지되어 로그인할 수 없습니다."
      : "Your account is suspended.";
  }

  if (errorCode === "google_secure_browser_required") {
    return language === "ko"
      ? "일부 인앱 브라우저에서는 소셜 로그인이 차단될 수 있습니다. 크롬 또는 사파리 같은 기본 브라우저로 열어서 다시 시도해주세요."
      : "Social sign-in is blocked inside some in-app browsers. Open this page in Chrome, Safari, or another system browser and try again.";
  }

  return language === "ko"
    ? "로그인에 실패했습니다. 다시 시도해주세요."
    : "Sign-in failed. Please try again.";
}

function getAuthReasonMessage(reason: string | null, language: "en" | "ko") {
  if (reason === "trial_limit") {
    return language === "ko"
      ? "체험판 5회를 모두 사용했습니다. 계속 사용하려면 로그인해 주세요."
      : "You have used all 5 trial conversations. Sign in to continue.";
  }

  if (reason === "trial_login_required") {
    return language === "ko"
      ? "같은 기기에서 체험판을 다시 시작할 수 없습니다. 계속하려면 로그인해 주세요."
      : "This device cannot start another anonymous trial. Sign in to continue.";
  }

  return "";
}

const oauthText = {
  en: {
    google: "Continue with Google",
    kakao: "Continue with Kakao",
    divider: "or with email",
    forgotPassword: "Forgot password?",
    checkEmailTitle: "Check your email",
    checkEmailDescription:
      "We've sent a confirmation link. Click it to finish creating your account.",
  },
  ko: {
    google: "구글로 계속하기",
    kakao: "카카오로 계속하기",
    divider: "또는 이메일로",
    forgotPassword: "비밀번호를 잊으셨나요?",
    checkEmailTitle: "이메일을 확인해주세요",
    checkEmailDescription:
      "인증 링크를 보냈습니다. 링크를 클릭하면 가입이 완료됩니다.",
  },
} as const;

export function AuthForm({ mode }: AuthFormProps) {
  const { language, t } = useLanguage();
  const oauthCopy = oauthText[language];
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [nextPath, setNextPath] = useState("/app/workbench");
  const [oauthErrorCode, setOauthErrorCode] = useState<string | null>(null);
  const [reasonCode, setReasonCode] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);
  const [awaitingEmailConfirmation, setAwaitingEmailConfirmation] = useState(false);
  const captchaRequired = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(sanitizeNextPath(params.get("next")));
    setOauthErrorCode(params.get("error"));
    setReasonCode(params.get("reason"));
  }, []);

  const oauthError = getOAuthErrorMessage(oauthErrorCode, language);
  const authReason = getAuthReasonMessage(reasonCode, language);
  const isSignUp = mode === "sign-up";

  function oauthHref(provider: "google" | "kakao") {
    return `/api/auth/oauth/${provider}?next=${encodeURIComponent(nextPath)}`;
  }

  function handleOAuthClick(
    provider: "google" | "kakao",
    event: MouseEvent<HTMLAnchorElement>,
  ) {
    if (typeof navigator === "undefined") {
      return;
    }
    if (!isLikelyEmbeddedBrowser(navigator.userAgent)) {
      return;
    }

    event.preventDefault();
    window.location.href = buildOpenInBrowserPath(oauthHref(provider));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const supabase = createSupabaseBrowserClient();

    if (isSignUp) {
      const name = String(formData.get("name") || "").trim();
      const confirmPassword = String(formData.get("confirmPassword") || "");

      if (password !== confirmPassword) {
        setError(t("confirmPassword"));
        setLoading(false);
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          captchaToken: turnstileToken || undefined,
          data: name ? { display_name: name } : undefined,
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });

      setTurnstileToken("");
      setTurnstileResetSignal((value) => value + 1);

      if (signUpError) {
        setError(signUpError.message || t("authFailed"));
        setLoading(false);
        return;
      }

      if (!data.session) {
        // Email confirmation is required before a session is issued.
        setAwaitingEmailConfirmation(true);
        setLoading(false);
        return;
      }

      window.location.href = nextPath;
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken: turnstileToken || undefined },
    });

    setTurnstileToken("");
    setTurnstileResetSignal((value) => value + 1);

    if (signInError) {
      setError(signInError.message || t("authFailed"));
      setLoading(false);
      return;
    }

    window.location.href = nextPath;
  }

  if (awaitingEmailConfirmation) {
    return (
      <div className="space-y-2 rounded-md border border-teal-200 bg-teal-50 px-4 py-3">
        <p className="text-sm font-semibold text-teal-900">
          {oauthCopy.checkEmailTitle}
        </p>
        <p className="text-sm leading-6 text-teal-800">
          {oauthCopy.checkEmailDescription}
        </p>
      </div>
    );
  }

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
      ) : (
        <p className="text-right text-sm">
          <Link href="/forgot-password" className="font-medium text-teal-700 hover:text-teal-900">
            {oauthCopy.forgotPassword}
          </Link>
        </p>
      )}

      <TurnstileWidget
        onVerify={setTurnstileToken}
        onExpire={() => setTurnstileToken("")}
        resetSignal={turnstileResetSignal}
      />

      <div className="space-y-2">
        <a
          href={oauthHref("google")}
          onClick={(event) => handleOAuthClick("google", event)}
          className="block w-full rounded-md border border-stone-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-stone-800 hover:bg-stone-50"
        >
          {oauthCopy.google}
        </a>
        <a
          href={oauthHref("kakao")}
          onClick={(event) => handleOAuthClick("kakao", event)}
          className="block w-full rounded-md border border-stone-300 bg-[#FEE500] px-4 py-2.5 text-center text-sm font-semibold text-[#191919] hover:brightness-95"
        >
          {oauthCopy.kakao}
        </a>
      </div>

      <p className="text-center text-xs font-medium uppercase tracking-wide text-stone-500">
        {oauthCopy.divider}
      </p>

      {error || oauthError || authReason ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error || oauthError || authReason}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading || (captchaRequired && !turnstileToken)}
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
