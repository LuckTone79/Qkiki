"use client";

import { AuthForm } from "@/components/AuthForm";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export default function SignUpPage() {
  const { t } = useLanguage();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8f3] px-5 py-10">
      <section className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
          Qkiki
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
          {t("createAccount")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          {t("signUpDescription")}
        </p>
        <div className="mt-6">
          <AuthForm mode="sign-up" />
        </div>
      </section>
    </main>
  );
}
