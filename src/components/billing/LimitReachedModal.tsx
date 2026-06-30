"use client";

import { localize } from "@/lib/i18n";

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
    localize(language, { en: "You've used your available credits.", ko: "사용 가능한 크레딧을 모두 사용했어요.", ja: "\u5229\u7528\u53EF\u80FD\u306A\u30AF\u30EC\u30B8\u30C3\u30C8\u3092\u4F7F\u3044\u679C\u305F\u3057\u307E\u3057\u305F\u3002", es: "Has utilizado tus cr\u00E9ditos disponibles." });

  const description =
    localize(language, { en: dailyIsBinding
        ? `Only ${usage.totalDailyCreditsAvailable.toLocaleString("en-US")} of your daily ${usage.dailyCreditLimit.toLocaleString("en-US")} credits remain. They reset at midnight (KST).`
        : `You currently have ${usage.totalCreditsAvailable.toLocaleString("en-US")} credits left.`, ko: dailyIsBinding
        ? `오늘 남은 크레딧은 ${usage.totalDailyCreditsAvailable.toLocaleString("ko-KR")}입니다(일일 한도 ${usage.dailyCreditLimit.toLocaleString("ko-KR")}). 자정(KST)에 초기화됩니다.`
        : `현재 남은 크레딧은 ${usage.totalCreditsAvailable.toLocaleString("ko-KR")}입니다.`, ja: dailyIsBinding ? `\u306E\u307F${usage.totalDailyCreditsAvailable.toLocaleString("en-US")}\u3042\u306A\u305F\u306E\u6BCE\u65E5\u306E${usage.dailyCreditLimit.toLocaleString("en-US")}\u30AF\u30EC\u30B8\u30C3\u30C8\u306F\u6B8B\u308A\u307E\u3059\u3002\u6DF1\u591C (KST) \u306B\u30EA\u30BB\u30C3\u30C8\u3055\u308C\u307E\u3059\u3002` : `\u73FE\u5728\u3042\u306A\u305F\u304C\u6301\u3063\u3066\u3044\u308B\u306E\u306F\u3001${usage.totalCreditsAvailable.toLocaleString("en-US")}\u30AF\u30EC\u30B8\u30C3\u30C8\u304C\u6B8B\u3063\u3066\u3044\u307E\u3059\u3002`, es: dailyIsBinding ? `Solo${usage.totalDailyCreditsAvailable.toLocaleString("en-US")}de tu diario${usage.dailyCreditLimit.toLocaleString("en-US")}quedan cr\u00E9ditos. Se reinician a medianoche (KST).` : `Actualmente tienes${usage.totalCreditsAvailable.toLocaleString("en-US")}cr\u00E9ditos restantes.` });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-stone-950/40 px-4 py-4 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">Yapp</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-stone-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">{description}</p>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          {localize(language, { en: "Choose one of the options below to keep going.", ko: "지금 계속 사용하려면 아래 옵션을 선택할 수 있어요.", ja: "\u7D9A\u884C\u3059\u308B\u306B\u306F\u3001\u4EE5\u4E0B\u306E\u30AA\u30D7\u30B7\u30E7\u30F3\u306E\u3044\u305A\u308C\u304B\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002", es: "Elija una de las siguientes opciones para continuar." })}
        </p>

        <div className="mt-6 grid gap-3">
          <Link
            href="/app/pricing?intent=monthly"
            className="rounded-lg bg-stone-950 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-stone-800"
          >
            {localize(language, { en: "Start monthly plan", ko: "월구독 시작하기", ja: "\u6708\u984D\u30D7\u30E9\u30F3\u3092\u59CB\u3081\u308B", es: "Iniciar plan mensual" })}
          </Link>
          <Link
            href="/app/pricing?intent=yearly"
            className="rounded-lg border border-stone-300 px-4 py-3 text-center text-sm font-semibold text-stone-800 hover:bg-stone-50"
          >
            {localize(language, { en: "Get yearly discount", ko: "연구독으로 할인받기", ja: "\u5E74\u9593\u5272\u5F15\u3092\u53D7\u3051\u308B", es: "Obt\u00E9n descuento anual" })}
          </Link>
          <Link
            href="/app/pricing?intent=credit"
            className="rounded-lg border border-stone-300 px-4 py-3 text-center text-sm font-semibold text-stone-800 hover:bg-stone-50"
          >
            {localize(language, { en: "Buy credit pack", ko: "필요한 만큼만 충전하기", ja: "\u30AF\u30EC\u30B8\u30C3\u30C8\u30D1\u30C3\u30AF\u3092\u8CFC\u5165\u3059\u308B", es: "Comprar paquete de cr\u00E9ditos" })}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-stone-200 px-4 py-3 text-sm font-semibold text-stone-600 hover:bg-stone-50"
          >
            {localize(language, { en: "Use again tomorrow", ko: "내일 다시 사용하기", ja: "\u660E\u65E5\u307E\u305F\u5229\u7528\u3057\u307E\u3059", es: "Usar de nuevo ma\u00F1ana" })}
          </button>
        </div>
      </div>
    </div>
  );
}
