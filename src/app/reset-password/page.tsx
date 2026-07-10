"use client";

import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { useLanguage } from "@/components/i18n/LanguageProvider";

const text = {
  en: { title: "Choose a new password" },
  ko: { title: "새 비밀번호 설정" },
} as const;

export default function ResetPasswordPage() {
  const { language } = useLanguage();
  const t = text[language];

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#ffffff] px-5 py-10">
      <section className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-7">
        <p className="flex items-center gap-2 font-serif text-lg font-semibold tracking-tight text-stone-950">
          <span aria-hidden="true">⬡</span> Yapp
        </p>
        <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-stone-950">
          {t.title}
        </h1>
        <div className="mt-6">
          <ResetPasswordForm />
        </div>
      </section>
    </main>
  );
}
