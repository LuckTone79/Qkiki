"use client";

import { useLanguage } from "@/components/i18n/LanguageProvider";
import type { UsageStatus as UsageStatusType } from "@/lib/usage-types";

function formatResetAt(value: string, language: "en" | "ko") {
  return new Intl.DateTimeFormat(language === "ko" ? "ko-KR" : "en-US", {
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
  const locale = language === "ko" ? "ko-KR" : "en-US";
  const creditUnit = language === "ko" ? "크레딧" : "credits";

  const title =
    language === "ko"
      ? usage.isAnonymous
        ? "Yapp 체험 (비로그인)"
        : usage.isBoostActive
          ? "Yapp Boost 사용 중"
          : usage.planType === "PRO"
            ? "Yapp Pro 플랜"
            : usage.planType === "STARTER"
              ? "Yapp Starter 플랜"
              : usage.planType === "TEAM"
                ? "Yapp Team 플랜"
                : "Yapp 무료 사용량"
      : usage.isAnonymous
        ? "Yapp trial (signed out)"
        : usage.isBoostActive
          ? "Yapp Boost active"
          : usage.planType === "PRO"
            ? "Yapp Pro plan"
            : usage.planType === "STARTER"
              ? "Yapp Starter plan"
              : usage.planType === "TEAM"
                ? "Yapp Team plan"
                : "Yapp free usage";

  const primary = usage.isUnlimitedCredits
    ? language === "ko"
      ? "남은 크레딧: 무제한"
      : "Credits available: Unlimited"
    : language === "ko"
      ? `남은 크레딧: ${usage.totalCreditsAvailable.toLocaleString(locale)} ${creditUnit}`
      : `Credits available: ${usage.totalCreditsAvailable.toLocaleString(locale)} ${creditUnit}`;

  const secondary =
    language === "ko"
      ? usage.isAnonymous
        ? `비로그인은 하루 ${usage.dailyCreditLimit.toLocaleString(locale)}크레딧입니다. 로그인하면 하루 70크레딧이 적용돼요.`
        : usage.isUnlimitedCredits
          ? "무제한 크레딧 쿠폰이 적용 중이에요."
          : usage.isBoostActive
            ? `Boost 종료까지 ${usage.boostDaysRemaining}일 남았어요.`
            : `오늘 남은 크레딧 ${usage.totalDailyCreditsAvailable.toLocaleString(locale)} / 일일 한도 ${usage.dailyCreditLimit.toLocaleString(locale)}`
      : usage.isAnonymous
        ? `Signed-out visitors get ${usage.dailyCreditLimit.toLocaleString(locale)} credits/day. Sign in to get 70 credits/day.`
        : usage.isUnlimitedCredits
          ? "An unlimited-credit coupon is active."
          : usage.isBoostActive
            ? `${usage.boostDaysRemaining} day(s) left in Boost.`
            : `Today ${usage.totalDailyCreditsAvailable.toLocaleString(locale)} left / daily cap ${usage.dailyCreditLimit.toLocaleString(locale)}`;

  const guidance =
    language === "ko"
      ? "실행 전 예상 크레딧을 먼저 확인하세요. 반복 구간·긴 첨부·이미지 생성은 크레딧을 더 빠르게 소모합니다."
      : "Check the estimated credits before you run. Repeat blocks, large attachments, and image generation consume credits faster.";

  const warning =
    !usage.isUnlimitedCredits && usage.isCreditLimitReached
      ? language === "ko"
        ? "사용 가능한 크레딧을 모두 사용했어요."
        : "Available credits have been exhausted."
      : !usage.isUnlimitedCredits && usage.warningThresholdReached
        ? language === "ko"
          ? `크레딧이 거의 다 찼어요. 남은 크레딧: ${usage.totalCreditsAvailable.toLocaleString(locale)}`
          : `You're close to the limit. Credits left: ${usage.totalCreditsAvailable.toLocaleString(locale)}`
        : null;

  const cards: { label: string; value: string }[] = [
    {
      label: language === "ko" ? "월 크레딧" : "Month credits",
      value: usage.isUnlimitedCredits
        ? "∞"
        : usage.monthlyCreditsRemaining.toLocaleString(locale),
    },
    {
      label: language === "ko" ? "오늘 남은" : "Today left",
      value: usage.isUnlimitedCredits
        ? "∞"
        : usage.totalDailyCreditsAvailable.toLocaleString(locale),
    },
    {
      label: language === "ko" ? "일일 한도" : "Daily cap",
      value: usage.isUnlimitedCredits
        ? "∞"
        : usage.dailyCreditLimit.toLocaleString(locale),
    },
    {
      label: language === "ko" ? "쿠폰" : "Coupon",
      value: usage.couponCreditBalance.toLocaleString(locale),
    },
    {
      label: language === "ko" ? "지갑" : "Wallet",
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
        {language === "ko" ? "다음 초기화" : "Next reset"}:{" "}
        {formatResetAt(usage.resetAt, language)}
      </p>
    </section>
  );
}
