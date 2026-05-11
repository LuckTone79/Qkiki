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

  const title =
    language === "ko"
      ? usage.isBoostActive
        ? "오늘의 Boost 사용량을 모두 사용했어요."
        : "오늘의 무료 사용량을 모두 사용했어요."
      : "You've used all of today's available runs.";

  const description =
    language === "ko"
      ? `내일 다시 ${usage.dailyLimit}회가 충전됩니다.`
      : `${usage.dailyLimit} uses will refresh tomorrow.`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
          Qkiki
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-stone-950">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">{description}</p>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          {language === "ko"
            ? "계속 사용하려면 아래 옵션을 선택할 수 있어요."
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
