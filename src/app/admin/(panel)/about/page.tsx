"use client";

import { APP_VERSION } from "@/lib/version";
import { useLanguage } from "@/components/i18n/LanguageProvider";

const aboutContent = {
  en: {
    title: "About",
    appName: "Qkiki Admin",
    version: "Version",
    description: "Operations console for managing Qkiki services.",
  },
  ko: {
    title: "정보",
    appName: "Qkiki 관리자",
    version: "버전",
    description: "Qkiki 서비스를 관리하는 운영 콘솔입니다.",
  },
};

export default function AboutPage() {
  const { language } = useLanguage();
  const t = aboutContent[language];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-950">{t.title}</h1>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-500">{t.appName}</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">Qkiki</p>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <p className="text-sm font-medium text-slate-500">{t.version}</p>
            <p className="mt-1 text-lg font-mono font-semibold text-blue-600">
              {APP_VERSION}
            </p>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <p className="text-sm text-slate-600">{t.description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
