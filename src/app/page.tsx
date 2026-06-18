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

  // Parallel-compare mock: one prompt fans out to every model at once,
  // each card surfacing latency + token cost so differences are obvious.
  const parallelCards = [
    { name: "GPT", badge: "bg-blue-50 text-blue-700", line: "bg-blue-200/70", time: "1.1s", tok: "312" },
    { name: "Claude", badge: "bg-violet-50 text-violet-700", line: "bg-violet-200/70", time: "1.4s", tok: "298" },
    { name: "Gemini", badge: "bg-emerald-50 text-emerald-700", line: "bg-emerald-200/70", time: "0.9s", tok: "275" },
    { name: "Grok", badge: "bg-orange-50 text-orange-700", line: "bg-orange-200/70", time: "1.3s", tok: "301" },
  ];

  // Sequential chain: each model plays a specialized role and its output
  // is auto-fed as the next step's input.
  const chainFlow: Array<{ model: string; action: string; desc: string }> = [
    { model: "GPT", action: language === "ko" ? "초안 생성" : "Draft", desc: t("stepDraftAnswer") },
    { model: "Grok", action: language === "ko" ? "비판" : "Critique", desc: t("stepCritiqueFlaws") },
    { model: "Gemini", action: language === "ko" ? "개선" : "Improve", desc: t("stepImproveCritique") },
    { model: "Claude", action: language === "ko" ? "최종 완성" : "Finalize", desc: t("stepFinalAnswer") },
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
        </div>

        <div className="relative z-10 mb-12 flex w-full max-w-3xl flex-col gap-3 px-5 sm:flex-row sm:px-8">
          <button
            type="button"
            onClick={handleTrialStart}
            disabled={isLoading}
            className="flex-1 rounded bg-white/95 px-6 py-3.5 text-center text-sm font-semibold tracking-wide text-[#171a20] backdrop-blur transition hover:bg-white disabled:opacity-60"
          >
            {isLoading ? "Loading..." : t("getStarted")}
          </button>
          <Link
            href="/guide"
            className="flex-1 inline-flex items-center justify-center gap-2 rounded bg-teal-500 px-6 py-3.5 text-center text-sm font-semibold tracking-wide text-white shadow-lg ring-1 ring-teal-300/40 transition hover:bg-teal-400"
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

        {/* Parallel-compare visualization */}
        <div className="mx-auto w-full max-w-4xl px-5">
          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-md sm:p-8">
            {/* one prompt */}
            <div className="mx-auto max-w-md rounded-xl border border-[#171a20]/10 bg-[#fafafa] px-4 py-3 text-center text-sm italic text-[#171a20]/60">
              {language === "ko"
                ? '"신제품 출시 카피를 써줘"'
                : '"Write a launch copy for our new product"'}
            </div>

            {/* fan-out indicator */}
            <div className="my-3 flex flex-col items-center">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-600">
                {language === "ko"
                  ? "4개 모델에 동시 전송"
                  : "Sent to 4 models at once"}
              </span>
              <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 text-teal-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
            </div>

            {/* result cards side by side */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {parallelCards.map((card) => (
                <div
                  key={card.name}
                  className="rounded-xl border border-black/5 bg-white p-3 text-left shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${card.badge}`}>
                      {card.name}
                    </span>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <div className={`h-1.5 rounded-full ${card.line}`} />
                    <div className={`h-1.5 w-4/5 rounded-full ${card.line}`} />
                    <div className={`h-1.5 w-3/5 rounded-full ${card.line}`} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[10px] text-[#171a20]/40">
                    <span>⏱ {card.time}</span>
                    <span>{card.tok} tok</span>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-5 text-center text-xs text-[#171a20]/45">
              {language === "ko"
                ? "탭을 4개 열 필요 없이, 답변 · 속도 · 비용을 한 화면에서 비교합니다."
                : "No more juggling 4 tabs — compare answers, speed, and cost on one screen."}
            </p>
          </div>
        </div>

        {/* supporting feature chips */}
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

        {/* Sequential chain visualization — output feeds the next input */}
        <div className="mx-auto w-full max-w-5xl px-5">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-stretch">
            {chainFlow.map((step, index) => {
              const isFinal = index === chainFlow.length - 1;
              return (
                <div key={step.model} className="flex flex-col items-center gap-3 sm:flex-1 sm:flex-row">
                  <div
                    className={`w-full flex-1 rounded-xl border p-4 text-left transition ${
                      isFinal
                        ? "border-teal-400/60 bg-teal-400/10 ring-1 ring-teal-300/30"
                        : "border-white/15 bg-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
                        {t("step")} {String(index + 1).padStart(2, "0")}
                      </span>
                      {isFinal ? (
                        <span className="rounded-full bg-teal-400/20 px-2 py-0.5 text-[10px] font-semibold text-teal-200">
                          {language === "ko" ? "최종" : "Final"}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-base font-semibold text-white">{step.model}</p>
                    <span
                      className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[11px] font-medium ${
                        isFinal ? "bg-teal-400/20 text-teal-100" : "bg-white/10 text-white/70"
                      }`}
                    >
                      {step.action}
                    </span>
                    <p className="mt-2 text-sm leading-6 text-white/70">{step.desc}</p>
                  </div>

                  {/* connector: down on mobile, right on desktop */}
                  {!isFinal ? (
                    <span className="flex-none text-white/30">
                      <svg viewBox="0 0 24 24" className="h-5 w-5 rotate-90 sm:rotate-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-center text-xs text-white/45">
            {language === "ko"
              ? "각 단계의 출력이 다음 단계의 입력으로 자동 전달됩니다 — 복사·붙여넣기 없이."
              : "Each step's output is auto-passed as the next step's input — no copy-paste."}
          </p>

          {/* Repeat-loop highlight — re-run a step range until quality converges */}
          <div className="mx-auto mt-6 max-w-2xl rounded-xl border border-teal-400/30 bg-teal-400/[0.07] p-5">
            <div className="flex items-center justify-center gap-2">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-teal-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 2.1 21 6l-4 3.9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <path d="M7 21.9 3 18l4-3.9" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
              <span className="text-sm font-semibold text-teal-200">
                {language === "ko" ? "반복 루프 설정" : "Repeat-loop setting"}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-white/75">
                Grok · {language === "ko" ? "비판" : "Critique"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-teal-400/40 bg-teal-400/10 px-2.5 py-1 text-[11px] font-semibold text-teal-200">
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 2.1 21 6l-4 3.9" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <path d="M7 21.9 3 18l4-3.9" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
                ×3
              </span>
              <span className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-white/75">
                Gemini · {language === "ko" ? "개선" : "Improve"}
              </span>
            </div>

            <p className="mt-4 text-center text-xs leading-5 text-white/60">
              {language === "ko"
                ? "원하는 단계 구간(시작~종료)을 반복 횟수만큼 자동으로 돌려, 품질이 수렴할 때까지 다듬습니다. 최대 10개 구간 · 총 50단계까지."
                : "Loop any step range (start–end) for as many passes as you set, refining until quality converges. Up to 10 ranges · 50 total steps."}
            </p>
          </div>
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
