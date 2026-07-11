"use client";

import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";
import { useLanguage } from "@/components/i18n/LanguageProvider";

const text = {
  en: {
    title: "Reset your password",
    description: "Enter your email and we'll send you a reset link.",
  },
  ko: {
    title: "비밀번호 재설정",
    description: "이메일을 입력하면 재설정 링크를 보내드립니다.",
  },
} as const;

export default function ForgotPasswordPage() {
  const { language } = useLanguage();
  const t = text[language === "ko" ? "ko" : "en"];

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#ffffff] px-5 py-10">
      <section className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-7">
        <p className="flex items-center gap-2 font-serif text-lg font-semibold tracking-tight text-stone-950">
          <span aria-hidden="true">⬡</span> Yapp
        </p>
        <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-stone-950">
          {t.title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">{t.description}</p>
        <div className="mt-6">
          <ForgotPasswordForm />
        </div>
      </section>
    </main>
  );
}
