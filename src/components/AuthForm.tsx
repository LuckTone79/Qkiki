"use client";

import { type AppLanguage } from "@/lib/i18n";

import { localize } from "@/lib/i18n";

import Link from "next/link";
import { FormEvent, MouseEvent, useEffect, useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import {
  buildOpenInBrowserPath,
  isLikelyEmbeddedBrowser,
} from "@/lib/browser-detection";

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

function getOAuthErrorMessage(errorCode: string | null, language: AppLanguage) {
  if (!errorCode) {
    return "";
  }

  if (errorCode === "google_not_configured") {
    return localize(language, { en: "Google sign-in is not configured yet. Contact your administrator.", ko: "\uad6c\uae00 \ub85c\uadf8\uc778 \uc124\uc815\uc774 \uc644\ub8cc\ub418\uc9c0 \uc54a\uc558\uc2b5\ub2c8\ub2e4. \uad00\ub9ac\uc790\uc5d0\uac8c \ubb38\uc758\ud574\uc8fc\uc138\uc694.", ja: "Google \u30B5\u30A4\u30F3\u30A4\u30F3\u306F\u307E\u3060\u8A2D\u5B9A\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002\u7BA1\u7406\u8005\u306B\u9023\u7D61\u3057\u3066\u304F\u3060\u3055\u3044\u3002", es: "El inicio de sesi\u00F3n de Google a\u00FAn no est\u00E1 configurado. P\u00F3ngase en contacto con su administrador." });
  }

  if (errorCode === "account_suspended") {
    return localize(language, { en: "Your account is suspended.", ko: "\uacc4\uc815\uc774 \uc815\uc9c0\ub418\uc5b4 \ub85c\uadf8\uc778\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.", ja: "\u3042\u306A\u305F\u306E\u30A2\u30AB\u30A6\u30F3\u30C8\u306F\u505C\u6B62\u3055\u308C\u3066\u3044\u307E\u3059\u3002", es: "Su cuenta est\u00E1 suspendida." });
  }

  if (errorCode === "google_secure_browser_required") {
    return localize(language, { en: "Google sign-in is blocked inside some in-app browsers. Open this page in Chrome, Safari, or another system browser and try again.", ko: "\uad6c\uae00 \ub85c\uadf8\uc778\uc740 \uce74\uce74\uc624\ud1a1 \uac19\uc740 \uc778\uc571 \ube0c\ub77c\uc6b0\uc800\uc5d0\uc11c \ucc28\ub2e8\ub420 \uc218 \uc788\uc2b5\ub2c8\ub2e4. \ud06c\ub86c \ub610\ub294 \uc0ac\ud30c\ub9ac \uac19\uc740 \uae30\ubcf8 \ube0c\ub77c\uc6b0\uc800\ub85c \uc5f4\uc5b4\uc11c \ub2e4\uc2dc \uc2dc\ub3c4\ud574\uc8fc\uc138\uc694.", ja: "Google \u30B5\u30A4\u30F3\u30A4\u30F3\u306F\u3001\u4E00\u90E8\u306E\u30A2\u30D7\u30EA\u5185\u30D6\u30E9\u30A6\u30B6\u30FC\u5185\u3067\u30D6\u30ED\u30C3\u30AF\u3055\u308C\u307E\u3059\u3002 Chrome\u3001Safari\u3001\u307E\u305F\u306F\u5225\u306E\u30B7\u30B9\u30C6\u30E0 \u30D6\u30E9\u30A6\u30B6\u3067\u3053\u306E\u30DA\u30FC\u30B8\u3092\u958B\u3044\u3066\u3001\u3082\u3046\u4E00\u5EA6\u8A66\u3057\u3066\u304F\u3060\u3055\u3044\u3002", es: "El inicio de sesi\u00F3n de Google est\u00E1 bloqueado en algunos navegadores integrados en la aplicaci\u00F3n. Abra esta p\u00E1gina en Chrome, Safari u otro navegador del sistema e int\u00E9ntelo de nuevo." });
  }

  return localize(language, { en: "Google sign-in failed. Please try again.", ko: "\uad6c\uae00 \ub85c\uadf8\uc778\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4. \ub2e4\uc2dc \uc2dc\ub3c4\ud574\uc8fc\uc138\uc694.", ja: "Google \u30B5\u30A4\u30F3\u30A4\u30F3\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002\u3082\u3046\u4E00\u5EA6\u8A66\u3057\u3066\u304F\u3060\u3055\u3044\u3002", es: "Error al iniciar sesi\u00F3n en Google. Por favor int\u00E9ntalo de nuevo." });
}

function getAuthReasonMessage(reason: string | null, language: AppLanguage) {
  if (reason === "trial_limit") {
    return localize(language, { en: "You have used all 5 trial conversations. Sign in to continue.", ko: "체험판 5회를 모두 사용했습니다. 계속 사용하려면 로그인해 주세요.", ja: "5 \u3064\u306E\u30C8\u30E9\u30A4\u30A2\u30EB\u4F1A\u8A71\u3092\u3059\u3079\u3066\u4F7F\u7528\u3057\u307E\u3057\u305F\u3002\u7D9A\u884C\u3059\u308B\u306B\u306F\u30B5\u30A4\u30F3\u30A4\u30F3\u3057\u3066\u304F\u3060\u3055\u3044\u3002", es: "Ha utilizado las 5 conversaciones de prueba. Inicia sesi\u00F3n para continuar." });
  }

  if (reason === "trial_login_required") {
    return localize(language, { en: "This device cannot start another anonymous trial. Sign in to continue.", ko: "같은 기기에서 체험판을 다시 시작할 수 없습니다. 계속하려면 로그인해 주세요.", ja: "\u3053\u306E\u30C7\u30D0\u30A4\u30B9\u3067\u306F\u3001\u5225\u306E\u533F\u540D\u30C8\u30E9\u30A4\u30A2\u30EB\u3092\u958B\u59CB\u3067\u304D\u307E\u305B\u3093\u3002\u7D9A\u884C\u3059\u308B\u306B\u306F\u30B5\u30A4\u30F3\u30A4\u30F3\u3057\u3066\u304F\u3060\u3055\u3044\u3002", es: "Este dispositivo no puede iniciar otra prueba an\u00F3nima. Inicia sesi\u00F3n para continuar." });
  }

  return "";
}

export function AuthForm({ mode }: AuthFormProps) {
  const { language, t } = useLanguage();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [nextPath, setNextPath] = useState("/app/workbench");
  const [oauthErrorCode, setOauthErrorCode] = useState<string | null>(null);
  const [reasonCode, setReasonCode] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(sanitizeNextPath(params.get("next")));
    setOauthErrorCode(params.get("error"));
    setReasonCode(params.get("reason"));
  }, []);

  const oauthError = getOAuthErrorMessage(oauthErrorCode, language);
  const authReason = getAuthReasonMessage(reasonCode, language);
  const googleCta =
    localize(language, { en: "Continue with Google", ko: "\uad6c\uae00\ub85c \uacc4\uc18d\ud558\uae30", ja: "Google \u3092\u7D9A\u3051\u308B", es: "Continuar con Google" });
  const dividerText = localize(language, { en: "or with email", ko: "\ub610\ub294 \uc774\uba54\uc77c\ub85c", ja: "\u307E\u305F\u306F\u30E1\u30FC\u30EB\u3067", es: "o con correo electr\u00F3nico" });
  const googleAuthHref = `/api/auth/google/start?next=${encodeURIComponent(nextPath)}`;

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
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      redirectUrl?: string;
    };

    if (!response.ok) {
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      setError(data.error || t("authFailed"));
      setLoading(false);
      return;
    }

    window.location.href = nextPath;
  }

  const isSignUp = mode === "sign-up";

  function handleGoogleSignIn(
    event: MouseEvent<HTMLAnchorElement>,
  ) {
    if (typeof navigator === "undefined") {
      return;
    }

    if (!isLikelyEmbeddedBrowser(navigator.userAgent)) {
      return;
    }

    event.preventDefault();
    window.location.href = buildOpenInBrowserPath(googleAuthHref);
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
      ) : null}

      <a
        href={googleAuthHref}
        onClick={handleGoogleSignIn}
        className="block w-full rounded-md border border-stone-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-stone-800 hover:bg-stone-50"
      >
        {googleCta}
      </a>

      <p className="text-center text-xs font-medium uppercase tracking-wide text-stone-500">
        {dividerText}
      </p>

      {error || oauthError || authReason ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error || oauthError || authReason}
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
