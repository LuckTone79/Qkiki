"use client";

import { type AppLanguage } from "@/lib/i18n";

import { localize } from "@/lib/i18n";

import { useLanguage } from "@/components/i18n/LanguageProvider";
import type { UsageStatus as UsageStatusType } from "@/lib/usage-types";

function formatResetAt(value: string, language: AppLanguage) {
  return new Intl.DateTimeFormat(localize(language, { en: "en-US", ko: "ko-KR", ja: "en-US", es: "en-US" }), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function UsageStatus({
  usage,
  compact = false,
}: {
  usage: UsageStatusType;
  compact?: boolean;
}) {
  const { language } = useLanguage();
  const locale = localize(language, { en: "en-US", ko: "ko-KR", ja: "en-US", es: "en-US" });
  const creditUnit = localize(language, { en: "credits", ko: "크레딧", ja: "\u30AF\u30EC\u30B8\u30C3\u30C8", es: "cr\u00E9ditos" });

  const title =
    localize(language, { en: usage.isAnonymous
        ? "Yapp trial (signed out)"
        : usage.isBoostActive
          ? "Yapp Boost active"
          : usage.planType === "PRO"
            ? "Yapp Pro plan"
            : usage.planType === "STARTER"
              ? "Yapp Starter plan"
              : usage.planType === "TEAM"
                ? "Yapp Team plan"
                : "Yapp free usage", ko: usage.isAnonymous
        ? "Yapp 체험 (비로그인)"
        : usage.isBoostActive
          ? "Yapp Boost 사용 중"
          : usage.planType === "PRO"
            ? "Yapp Pro 플랜"
            : usage.planType === "STARTER"
              ? "Yapp Starter 플랜"
              : usage.planType === "TEAM"
                ? "Yapp Team 플랜"
                : "Yapp 무료 사용량", ja: usage.isAnonymous ? "Yapp \u30C8\u30E9\u30A4\u30A2\u30EB (\u30B5\u30A4\u30F3\u30A2\u30A6\u30C8)" : usage.isBoostActive ? "\u30E4\u30C3\u30D7\u30D6\u30FC\u30B9\u30C8\u6709\u52B9" : usage.planType === "PRO" ? "\u30E4\u30C3\u30D7\u30D7\u30ED\u30D7\u30E9\u30F3" : usage.planType === "STARTER" ? "\u30E4\u30C3\u30D7\u30B9\u30BF\u30FC\u30BF\u30FC\u30D7\u30E9\u30F3" : usage.planType === "TEAM" ? "\u30E4\u30C3\u30D7\u30C1\u30FC\u30E0\u30D7\u30E9\u30F3" : "Yapp\u306E\u7121\u6599\u4F7F\u7528", es: usage.isAnonymous ? "Prueba de Yapp (cerrado sesi\u00F3n)" : usage.isBoostActive ? "Yapp Boost activo" : usage.planType === "PRO" ? "Plan Yapp Pro" : usage.planType === "STARTER" ? "Plan inicial de Yapp" : usage.planType === "TEAM" ? "Plan del equipo Yapp" : "Uso gratuito de Yapp" });

  const primary = usage.isUnlimitedCredits
    ? localize(language, { en: "Credits available: Unlimited", ko: "남은 크레딧: 무제한", ja: "\u5229\u7528\u53EF\u80FD\u306A\u30AF\u30EC\u30B8\u30C3\u30C8: \u7121\u5236\u9650", es: "Cr\u00E9ditos disponibles: Ilimitados" })
    : localize(language, { en: `Credits available: ${usage.totalCreditsAvailable.toLocaleString(locale)} ${creditUnit}`, ko: `남은 크레딧: ${usage.totalCreditsAvailable.toLocaleString(locale)} ${creditUnit}`, ja: `\u5229\u7528\u53EF\u80FD\u306A\u30AF\u30EC\u30B8\u30C3\u30C8:${usage.totalCreditsAvailable.toLocaleString(locale)} ${creditUnit}`, es: `Cr\u00E9ditos disponibles:${usage.totalCreditsAvailable.toLocaleString(locale)} ${creditUnit}` });

  const secondary =
    localize(language, { en: usage.isAnonymous
        ? `Signed-out visitors get ${usage.dailyCreditLimit.toLocaleString(locale)} credits/day. Sign in to get 70 credits/day.`
        : usage.isUnlimitedCredits
          ? "An unlimited-credit coupon is active."
          : usage.isBoostActive
            ? `${usage.boostDaysRemaining} day(s) left in Boost.`
            : `Today ${usage.totalDailyCreditsAvailable.toLocaleString(locale)} left / daily cap ${usage.dailyCreditLimit.toLocaleString(locale)}`, ko: usage.isAnonymous
        ? `비로그인은 하루 ${usage.dailyCreditLimit.toLocaleString(locale)}크레딧입니다. 로그인하면 하루 70크레딧이 적용돼요.`
        : usage.isUnlimitedCredits
          ? "무제한 크레딧 쿠폰이 적용 중이에요."
          : usage.isBoostActive
            ? `Boost 종료까지 ${usage.boostDaysRemaining}일 남았어요.`
            : `오늘 남은 크레딧 ${usage.totalDailyCreditsAvailable.toLocaleString(locale)} / 일일 한도 ${usage.dailyCreditLimit.toLocaleString(locale)}`, ja: usage.isAnonymous ? `\u30B5\u30A4\u30F3\u30A2\u30A6\u30C8\u3057\u305F\u8A2A\u554F\u8005\u304C\u5F97\u3089\u308C\u308B\u306E\u306F\u3001${usage.dailyCreditLimit.toLocaleString(locale)}\u30AF\u30EC\u30B8\u30C3\u30C8/\u65E5\u3002\u30B5\u30A4\u30F3\u30A4\u30F3\u3059\u308B\u3068 1 \u65E5\u3042\u305F\u308A 70 \u30AF\u30EC\u30B8\u30C3\u30C8\u3092\u53D6\u5F97\u3067\u304D\u307E\u3059\u3002` : usage.isUnlimitedCredits ? "\u7121\u5236\u9650\u306E\u30AF\u30EC\u30B8\u30C3\u30C8 \u30AF\u30FC\u30DD\u30F3\u304C\u6709\u52B9\u3067\u3059\u3002" : usage.isBoostActive ? `${usage.boostDaysRemaining}\u30D6\u30FC\u30B9\u30C8\u306E\u6B8B\u308A\u65E5\u6570\u3002` : `\u4ECA\u65E5${usage.totalDailyCreditsAvailable.toLocaleString(locale)}\u5DE6/1\u65E5\u306E\u4E0A\u9650${usage.dailyCreditLimit.toLocaleString(locale)}`, es: usage.isAnonymous ? `Los visitantes que hayan cerrado sesi\u00F3n obtienen${usage.dailyCreditLimit.toLocaleString(locale)}cr\u00E9ditos/d\u00EDa. Inicia sesi\u00F3n para obtener 70 cr\u00E9ditos/d\u00EDa.` : usage.isUnlimitedCredits ? "Hay un cup\u00F3n de cr\u00E9dito ilimitado activo." : usage.isBoostActive ? `${usage.boostDaysRemaining}D\u00EDa(s) restantes en Boost.` : `Hoy${usage.totalDailyCreditsAvailable.toLocaleString(locale)}l\u00EDmite izquierdo / diario${usage.dailyCreditLimit.toLocaleString(locale)}` });

  const guidance =
    localize(language, { en: "Check the estimated credits before you run. Repeat blocks, large attachments, and image generation consume credits faster.", ko: "실행 전 예상 크레딧을 먼저 확인하세요. 반복 구간·긴 첨부·이미지 생성은 크레딧을 더 빠르게 소모합니다.", ja: "\u5B9F\u884C\u3059\u308B\u524D\u306B\u3001\u63A8\u5B9A\u30AF\u30EC\u30B8\u30C3\u30C8\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u7E70\u308A\u8FD4\u3057\u30D6\u30ED\u30C3\u30AF\u3001\u5927\u304D\u306A\u6DFB\u4ED8\u30D5\u30A1\u30A4\u30EB\u3001\u753B\u50CF\u306E\u751F\u6210\u306B\u3088\u308A\u3001\u30AF\u30EC\u30B8\u30C3\u30C8\u306E\u6D88\u8CBB\u304C\u901F\u304F\u306A\u308A\u307E\u3059\u3002", es: "Verifique los cr\u00E9ditos estimados antes de correr. Los bloques repetidos, los archivos adjuntos grandes y la generaci\u00F3n de im\u00E1genes consumen cr\u00E9ditos m\u00E1s r\u00E1pido." });

  const warning =
    !usage.isUnlimitedCredits && usage.isCreditLimitReached
      ? localize(language, { en: "Available credits have been exhausted.", ko: "사용 가능한 크레딧을 모두 사용했어요.", ja: "\u5229\u7528\u53EF\u80FD\u306A\u30AF\u30EC\u30B8\u30C3\u30C8\u304C\u306A\u304F\u306A\u308A\u307E\u3057\u305F\u3002", es: "Los cr\u00E9ditos disponibles se han agotado." })
      : !usage.isUnlimitedCredits && usage.warningThresholdReached
        ? localize(language, { en: `You're close to the limit. Credits left: ${usage.totalCreditsAvailable.toLocaleString(locale)}`, ko: `크레딧이 거의 다 찼어요. 남은 크레딧: ${usage.totalCreditsAvailable.toLocaleString(locale)}`, ja: `\u3082\u3046\u9650\u754C\u306B\u8FD1\u3065\u3044\u3066\u3044\u307E\u3059\u3002\u6B8B\u308A\u306E\u30AF\u30EC\u30B8\u30C3\u30C8:${usage.totalCreditsAvailable.toLocaleString(locale)}`, es: `Est\u00E1s cerca del l\u00EDmite. Cr\u00E9ditos restantes:${usage.totalCreditsAvailable.toLocaleString(locale)}` })
        : null;

  const cards: { label: string; value: string }[] = [
    {
      label: localize(language, { en: "Month credits", ko: "월 크레딧", ja: "\u6708\u5358\u4F4D\u306E\u30AF\u30EC\u30B8\u30C3\u30C8", es: "cr\u00E9ditos mensuales" }),
      value: usage.isUnlimitedCredits
        ? "∞"
        : usage.monthlyCreditsRemaining.toLocaleString(locale),
    },
    {
      label: localize(language, { en: "Today left", ko: "오늘 남은", ja: "\u4ECA\u65E5\u306F\u6B8B\u308A\u307E\u3057\u305F", es: "hoy se fue" }),
      value: usage.isUnlimitedCredits
        ? "∞"
        : usage.totalDailyCreditsAvailable.toLocaleString(locale),
    },
    {
      label: localize(language, { en: "Daily cap", ko: "일일 한도", ja: "1\u65E5\u306E\u4E0A\u9650", es: "L\u00EDmite diario" }),
      value: usage.isUnlimitedCredits
        ? "∞"
        : usage.dailyCreditLimit.toLocaleString(locale),
    },
    {
      label: localize(language, { en: "Coupon", ko: "쿠폰", ja: "\u30AF\u30FC\u30DD\u30F3", es: "Cup\u00F3n" }),
      value: usage.couponCreditBalance.toLocaleString(locale),
    },
    {
      label: localize(language, { en: "Wallet", ko: "지갑", ja: "\u8CA1\u5E03", es: "Billetera" }),
      value: usage.walletCreditsAvailable.toLocaleString(locale),
    },
  ];

  return (
    <section
      className={`rounded-xl border border-stone-200 bg-white shadow-sm ${
        compact ? "p-4" : "p-5"
      }`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
            {title}
          </p>
          <p className="mt-2 text-lg font-semibold text-stone-950">{primary}</p>
          <p className="mt-1 text-sm text-stone-600">{secondary}</p>
        </div>
        <div className="grid min-w-52 grid-cols-2 gap-2 text-sm md:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-lg border border-stone-200 bg-[#f7f6f3] px-3 py-2"
            >
              <p className="text-xs text-stone-500">{card.label}</p>
              <p className="mt-1 font-semibold text-stone-950">{card.value}</p>
            </div>
          ))}
        </div>
      </div>

      {warning ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
          {warning}
        </div>
      ) : null}

      <div className="mt-4 rounded-lg border border-stone-200 bg-[#f7f6f3] px-3 py-3 text-xs leading-5 text-stone-600">
        {guidance}
      </div>

      <p className="mt-4 text-xs text-stone-500">
        {localize(language, { en: "Next reset", ko: "다음 초기화", ja: "\u6B21\u306E\u30EA\u30BB\u30C3\u30C8", es: "Siguiente reinicio" })}:{" "}
        {formatResetAt(usage.resetAt, language)}
      </p>
    </section>
  );
}
