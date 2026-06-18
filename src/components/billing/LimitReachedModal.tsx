"use client";

import Link from "next/link";
import type { UsageStatus } from "@/lib/usage-types";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export function LimitReachedModal({
  usage,
  open,
  onClose,
}: {
  usage: UsageStatus | null;
  open: boolean;
  onClose: () => void;
}) {
  const { language } = useLanguage();

  if (!open || !usage) {
    return null;
  }

  // The daily allowance is the binding constraint when there is still a monthly
  // balance left but today's credits are exhausted.
  const dailyIsBinding =
    usage.totalDailyCreditsAvailable < usage.totalCreditsAvailable;

  const title =
    language === "ko"
      ? "사용 가능한 크레딧을 모두 사용했어요."
      : "You've used your available credits.";

  const description =
    language === "ko"
      ? dailyIsBinding
        ? `오늘 남은 크레딧은 ${usage.totalDailyCreditsAvailable.toLocaleString("ko-KR")}입니다(일일 한도 ${usage.dailyCreditLimit.toLocaleString("ko-KR")}). 자정(KST)에 초기화됩니다.`
        : `현재 남은 크레딧은 ${usage.totalCreditsAvailable.toLocaleString("ko-KR")}입니다.`
      : dailyIsBinding
        ? `Only ${usage.totalDailyCreditsAvailable.toLocaleString("en-US")} of your daily ${usage.dailyCreditLimit.toLocaleString("en-US")} credits remain. They reset at midnight (KST).`
        : `You currently have ${usage.totalCreditsAvailable.toLocaleString("en-US")} credits left.`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Qkiki</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-stone-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">{description}</p>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          {language === "ko"
            ? "지금 계속 사용하려면 아래 옵션을 선택할 수 있어요."
            : "Choose one of the options below to keep going."}
        </p>

        <div className="mt-6 grid gap-3">
          <Link
            href="/app/pricing?intent=monthly"
            className="rounded-lg bg-stone-950 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-stone-800"
          >
            {language === "ko" ? "월구독 시작하기" : "Start monthly plan"}
          </Link>
          <Link
            href="/app/pricing?intent=yearly"
            className="rounded-lg border border-stone-300 px-4 py-3 text-center text-sm font-semibold text-stone-800 hover:bg-stone-50"
          >
            {language === "ko" ? "연구독으로 할인받기" : "Get yearly discount"}
          </Link>
          <Link
            href="/app/pricing?intent=credit"
            className="rounded-lg border border-stone-300 px-4 py-3 text-center text-sm font-semibold text-stone-800 hover:bg-stone-50"
          >
            {language === "ko" ? "필요한 만큼만 충전하기" : "Buy credit pack"}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-stone-200 px-4 py-3 text-sm font-semibold text-stone-600 hover:bg-stone-50"
          >
            {language === "ko" ? "내일 다시 사용하기" : "Use again tomorrow"}
          </button>
        </div>
      </div>
    </div>
  );
}
