"use client";

import { AuthForm } from "@/components/AuthForm";
import { APP_NAME } from "@/lib/brand";
import { BrandMark } from "@/components/ui/icons";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export default function SignInPage() {
  const { t } = useLanguage();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#ffffff] px-5 py-10">
      <section className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-7">
        <p className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-stone-950">
          <span
            aria-hidden="true"
            className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-stone-950 text-white"
          >
            <BrandMark className="h-[18px] w-[18px]" />
          </span>
          {APP_NAME}
        </p>
        <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-stone-950">
          {t("signIn")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          {t("signInDescription")}
        </p>
        <div className="mt-6">
          <AuthForm mode="sign-in" />
        </div>
      </section>
    </main>
  );
}
