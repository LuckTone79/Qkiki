"use client";

import Link from "next/link";
import type { UsageStatus } from "@/lib/usage-types";
import {
  localize,
  useLanguage,
  type AppLanguage,
} from "@/components/i18n/LanguageProvider";

const DATE_LOCALES: Record<AppLanguage, string> = {
  en: "en-US",
  ko: "ko-KR",
  ja: "ja-JP",
  es: "es-ES",
};

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

  const title = localize(language, {
    en: "You've used your available credits.",
    ko: "사용 가능한 크레딧을 모두 사용했어요.",
    ja: "利用可能なクレジットをすべて使い切りました。",
    es: "Has usado tus créditos disponibles.",
  });

  const dailyLeft = usage.totalDailyCreditsAvailable.toLocaleString(
    DATE_LOCALES[language],
  );
  const dailyCap = usage.dailyCreditLimit.toLocaleString(DATE_LOCALES[language]);
  const totalLeft = usage.totalCreditsAvailable.toLocaleString(
    DATE_LOCALES[language],
  );
  const description = dailyIsBinding
    ? localize(language, {
        en: `Only ${dailyLeft} of your daily ${dailyCap} credits remain. They reset at midnight (KST).`,
        ko: `오늘 남은 크레딧은 ${dailyLeft}입니다(일일 한도 ${dailyCap}). 자정(KST)에 초기화됩니다.`,
        ja: `1日の ${dailyCap} クレジットのうち残り ${dailyLeft} です。深夜（KST）にリセットされます。`,
        es: `Solo quedan ${dailyLeft} de tus ${dailyCap} créditos diarios. Se reinician a medianoche (KST).`,
      })
    : localize(language, {
        en: `You currently have ${totalLeft} credits left.`,
        ko: `현재 남은 크레딧은 ${totalLeft}입니다.`,
        ja: `現在の残りクレジットは ${totalLeft} です。`,
        es: `Actualmente te quedan ${totalLeft} créditos.`,
      });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-stone-950/40 px-4 py-4 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Yapp</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-stone-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">{description}</p>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          {localize(language, {
            en: "Choose one of the options below to keep going.",
            ko: "지금 계속 사용하려면 아래 옵션을 선택할 수 있어요.",
            ja: "続けて使うには、以下のオプションから選べます。",
            es: "Elige una de las opciones a continuación para continuar.",
          })}
        </p>

        <div className="mt-6 grid gap-3">
          <Link
            href="/app/pricing?intent=monthly"
            className="rounded-lg bg-stone-950 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-stone-800"
          >
            {localize(language, {
              en: "Start monthly plan",
              ko: "월구독 시작하기",
              ja: "月額プランを開始",
              es: "Iniciar plan mensual",
            })}
          </Link>
          <Link
            href="/app/pricing?intent=yearly"
            className="rounded-lg border border-stone-300 px-4 py-3 text-center text-sm font-semibold text-stone-800 hover:bg-stone-50"
          >
            {localize(language, {
              en: "Get yearly discount",
              ko: "연구독으로 할인받기",
              ja: "年額プランで割引",
              es: "Obtener descuento anual",
            })}
          </Link>
          <Link
            href="/app/pricing?intent=credit"
            className="rounded-lg border border-stone-300 px-4 py-3 text-center text-sm font-semibold text-stone-800 hover:bg-stone-50"
          >
            {localize(language, {
              en: "Buy credit pack",
              ko: "필요한 만큼만 충전하기",
              ja: "クレジットパックを購入",
              es: "Comprar paquete de créditos",
            })}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-stone-200 px-4 py-3 text-sm font-semibold text-stone-600 hover:bg-stone-50"
          >
            {localize(language, {
              en: "Use again tomorrow",
              ko: "내일 다시 사용하기",
              ja: "明日また使う",
              es: "Usar de nuevo mañana",
            })}
          </button>
        </div>
      </div>
    </div>
  );
}
