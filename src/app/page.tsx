"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export default function LandingPage() {
  const { language, t } = useLanguage();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [trialError, setTrialError] = useState("");

  const handleTrialStart = async () => {
    setTrialError("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/trial/start", {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        redirectUrl?: string;
      };
      if (data.redirectUrl && !response.ok) {
        router.push(data.redirectUrl);
        return;
      }
      if (data.success && data.redirectUrl) {
        router.push(data.redirectUrl);
        return;
      }
      setTrialError(
        data.error ||
          (language === "ko"
            ? "체험판을 시작할 수 없습니다."
            : "Unable to start the trial."),
      );
    } catch (error) {
      console.error("Trial start error:", error);
      setTrialError(
        language === "ko"
          ? "체험판을 시작할 수 없습니다."
          : "Unable to start the trial.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const features = [t("featureCompare"), t("featureRoute"), t("featureSave")];
  const routeExample: Array<[string, string]> = [
    ["GPT", t("stepDraftAnswer")],
    ["Grok", t("stepCritiqueFlaws")],
    ["Gemini", t("stepImproveCritique")],
    ["Claude", t("stepFinalAnswer")],
  ];
  const quickStarts = [
    {
      key: "parallel",
      title: language === "ko" ? "빠르게 비교하기" : "Quick compare",
      description:
        language === "ko"
          ? "같은 질문을 여러 모델에 보내고 답변 차이를 바로 비교합니다."
          : "Send one prompt to multiple models and compare the differences right away.",
    },
    {
      key: "sequential",
      title: language === "ko" ? "단계별 개선하기" : "Step-by-step improve",
      description:
        language === "ko"
          ? "초안 생성, 비판, 개선을 체인으로 묶어 끝까지 다듬습니다."
          : "Chain drafting, critique, and improvement into one guided run.",
    },
  ];

  const heroImage =
    "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1600&q=80";
  const guideLabel = language === "ko" ? "가이드북" : "Guidebook";

  return (
    <main className="bg-white text-[#171a20]">
      {/* HERO — Tesla full-bleed cinematic section */}
      <section className="relative flex min-h-[100svh] flex-col items-center justify-between overflow-hidden">
        <Image
          src={heroImage}
          alt="Yapp orchestration — networked architecture"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/55" />

        <div className="relative z-10 flex w-full flex-col items-center px-5 pt-28 text-center sm:pt-32">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/85">
            {t("landingEyebrow")}
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-tight text-white sm:text-6xl">
            {t("landingTitle")}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-white/85 sm:text-lg">
            {t("landingDescription")}
          </p>
          <Link
            href="/guide"
            className="group mt-5 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/15 px-5 py-2.5 text-sm font-semibold text-white shadow-lg ring-1 ring-black/5 backdrop-blur-md transition hover:border-white hover:bg-white hover:text-[#171a20]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            {guideLabel}
          </Link>
        </div>

        <div className="relative z-10 mb-12 flex w-full max-w-2xl flex-col gap-3 px-5 sm:flex-row sm:px-8">
          <button
            type="button"
            onClick={handleTrialStart}
            disabled={isLoading}
            className="flex-1 rounded bg-white/95 px-6 py-3.5 text-center text-sm font-semibold tracking-wide text-[#171a20] backdrop-blur transition hover:bg-white disabled:opacity-60"
          >
            {isLoading ? "Loading..." : t("getStarted")}
          </button>
          <Link
            href="/sign-in"
            className="flex-1 rounded bg-black/45 px-6 py-3.5 text-center text-sm font-semibold tracking-wide text-white backdrop-blur transition hover:bg-black/60"
          >
            {t("signIn")}
          </Link>
        </div>

        {trialError ? (
          <div className="absolute inset-x-0 bottom-28 z-20 mx-auto max-w-md px-5">
            <p className="rounded-md border border-rose-200 bg-rose-50/95 px-4 py-3 text-center text-sm text-rose-800 backdrop-blur">
              {trialError}
            </p>
          </div>
        ) : null}
      </section>

      {/* SECTION 2 — Parallel Compare / Feature highlights */}
      <section className="relative flex min-h-[100svh] flex-col items-center justify-between gap-12 bg-[#f4f4f4] py-16">
        <div className="px-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#171a20]/55">
            {language === "ko" ? "병렬 비교" : "Parallel compare"}
          </p>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            {language === "ko"
              ? "한 번에, 나란히."
              : "All at once. Side by side."}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[#171a20]/70 sm:text-lg">
            {language === "ko"
              ? "하나의 작업을 여러 모델에 동시에 보내고 한 화면에서 차이를 비교하세요."
              : "Send one task to multiple models simultaneously and compare differences on a single screen."}
          </p>
        </div>

        <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-3 px-5 sm:grid-cols-3">
          {features.map((feature, index) => (
            <div
              key={feature}
              className="rounded-xl bg-white px-5 py-6 text-left shadow-sm ring-1 ring-black/5"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-[#171a20]/45">
                {`0${index + 1}`}
              </p>
              <p className="mt-3 text-sm leading-6 text-[#171a20]/85">{feature}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 px-5">
          <button
            type="button"
            onClick={handleTrialStart}
            disabled={isLoading}
            className="rounded bg-[#171a20] px-12 py-3 text-sm font-semibold tracking-wide text-white transition hover:bg-black disabled:opacity-60"
          >
            {isLoading ? "Loading..." : t("getStarted")}
          </button>
        </div>
      </section>

      {/* SECTION 3 — Sequential Review Chain */}
      <section className="relative flex min-h-[100svh] flex-col items-center justify-between gap-12 bg-[#171a20] py-16 text-white">
        <div className="px-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/55">
            {language === "ko" ? "순차 검토 체인" : "Sequential review chain"}
          </p>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            {language === "ko"
              ? "한 출력이 다음 입력이 됩니다."
              : "One output becomes the next input."}
          </h2>
        </div>

        <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-3 px-5 sm:grid-cols-4">
          {routeExample.map(([model, text], index) => {
            const isFinal = index === routeExample.length - 1;
            return (
              <div
                key={model}
                className={`rounded-lg border px-4 py-5 text-left ${
                  isFinal
                    ? "border-white/40 bg-white/10"
                    : "border-white/15 bg-transparent"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-white/55">
                  {t("step")} {String(index + 1).padStart(2, "0")}
                </p>
                <p className="mt-2 text-base font-semibold text-white">{model}</p>
                <p className="mt-1 text-sm leading-6 text-white/75">{text}</p>
              </div>
            );
          })}
        </div>

        <div>
          <Link
            href="/sign-in"
            className="rounded bg-white px-12 py-3 text-sm font-semibold tracking-wide text-[#171a20] transition hover:bg-stone-200"
          >
            {language === "ko" ? "자세히" : "Learn more"}
          </Link>
        </div>
      </section>

      {/* SECTION 4 — Quick starts + final CTA */}
      <section className="relative flex min-h-[100svh] flex-col items-center justify-center gap-10 bg-white py-16 text-center">
        <div className="px-5">
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            {language === "ko"
              ? "모든 결과가 새로운 시작점."
              : "Every result is a new beginning."}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[#171a20]/70 sm:text-lg">
            {language === "ko"
              ? "분기 · 프로젝트 · 프리셋 · 파일 첨부까지, 한 작업대에서."
              : "Branch · projects · presets · file attachments — all in one workbench."}
          </p>
        </div>

        <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-3 px-5 sm:grid-cols-2">
          {quickStarts.map((item) => (
            <div
              key={item.key}
              className="rounded-xl bg-[#f4f4f4] px-5 py-6 text-left"
            >
              <p className="text-sm font-semibold text-[#171a20]">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-[#171a20]/70">
                {item.description}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 px-5">
          <button
            type="button"
            onClick={handleTrialStart}
            disabled={isLoading}
            className="rounded bg-[#171a20] px-12 py-3.5 text-sm font-semibold tracking-wide text-white transition hover:bg-black disabled:opacity-60"
          >
            {isLoading ? "Loading..." : t("getStarted")}
          </button>
          <Link
            href="/sign-in"
            className="rounded border border-[#171a20] px-12 py-3.5 text-sm font-semibold tracking-wide text-[#171a20] transition hover:bg-[#171a20] hover:text-white"
          >
            {t("signIn")}
          </Link>
          <Link
            href="/guide"
            className="rounded bg-[#f4f4f4] px-12 py-3.5 text-sm font-semibold tracking-wide text-[#171a20] transition hover:bg-stone-200"
          >
            {guideLabel}
          </Link>
        </div>
      </section>
    </main>
  );
}
