"use client";

import { AdminAuthForm } from "@/components/admin/AdminAuthForm";
import { useLanguage } from "@/components/i18n/LanguageProvider";

const signInCardText = {
  en: {
    adminTitle: "Qkiki Admin",
    heading: "Administrator sign-in",
    description:
      "Access user management, coupon controls, provider keys, and audit logs.",
  },
  ko: {
    adminTitle: "Qkiki \uAD00\uB9AC\uC790",
    heading: "\uAD00\uB9AC\uC790 \uB85C\uADF8\uC778",
    description:
      "\uC0AC\uC6A9\uC790 \uAD00\uB9AC, \uCFE0\uD3F0 \uC81C\uC5B4, \uACF5\uAE09\uC790 \uD0A4, \uAC10\uC0AC \uB85C\uADF8\uC5D0 \uC811\uADFC\uD569\uB2C8\uB2E4.",
  },
} as const;

export function AdminSignInCard() {
  const { language } = useLanguage();
  const t = signInCardText[language];

  return (
    <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-700">
        {t.adminTitle}
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
        {t.heading}
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">{t.description}</p>
      <div className="mt-6">
        <AdminAuthForm />
      </div>
    </section>
  );
}
