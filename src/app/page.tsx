"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export default function LandingPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleTrialStart = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/trial/start", {
        method: "POST",
      });
      const data = await response.json();
      if (data.success) {
        router.push(data.redirectUrl);
      }
    } catch (error) {
      console.error("Trial start error:", error);
      setIsLoading(false);
    }
  };

  const features = [t("featureCompare"), t("featureRoute"), t("featureSave")];
  const routeExample = [
    ["GPT", t("stepDraftAnswer")],
    ["Grok", t("stepCritiqueFlaws")],
    ["Gemini", t("stepImproveCritique")],
    ["Claude", t("stepFinalAnswer")],
  ];

  return (
    <main className="min-h-screen bg-[#f7f8f3] text-stone-950">
      <section className="mx-auto grid min-h-screen max-w-6xl gap-10 px-5 py-8 md:grid-cols-[1fr_0.9fr] md:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
            {t("landingEyebrow")}
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-tight text-stone-950 sm:text-6xl">
            {t("landingTitle")}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-600">
            {t("landingDescription")}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleTrialStart}
              disabled={isLoading}
              className="rounded-md bg-stone-950 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Loading..." : t("getStarted")}
            </button>
            <Link
              href="/sign-in"
              className="rounded-md border border-stone-300 bg-white px-5 py-3 text-center text-sm font-semibold text-stone-800 hover:bg-stone-50"
            >
              {t("signIn")}
            </Link>
          </div>

          <ul className="mt-10 grid gap-3 text-sm text-stone-700">
            {features.map((feature) => (
              <li
                key={feature}
                className="rounded-md border border-stone-200 bg-white/80 px-4 py-3"
              >
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
          <Image
            src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80"
            alt="Networked Earth from space"
            width={1200}
            height={600}
            className="h-56 w-full object-cover"
          />
          <div className="space-y-3 p-5">
            {routeExample.map(([model, text], index) => (
              <div
                key={model}
                className="grid grid-cols-[72px_1fr] items-center gap-3 rounded-md border border-stone-200 bg-[#fbfcf8] px-3 py-3"
              >
                <span className="text-xs font-semibold uppercase text-teal-700">
                  {t("step")} {index + 1}
                </span>
                <span className="text-sm text-stone-700">
                  {model}: {text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
