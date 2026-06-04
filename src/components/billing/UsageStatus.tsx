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
  const used = usage.dailyUsed;
  const limitLabel = usage.isUnlimitedDaily
    ? language === "ko"
      ? "무제한"
      : "Unlimited"
    : `${usage.dailyLimit}`;

  const title =
    language === "ko"
      ? usage.isBoostActive
        ? "Qkiki Boost 사용 중"
        : usage.planType === "PRO"
          ? "Qkiki Pro 플랜"
          : usage.planType === "STARTER"
            ? "Qkiki Starter 플랜"
            : usage.planType === "TEAM"
              ? "Qkiki Team 플랜"
              : "Qkiki 무료 사용량"
      : usage.isBoostActive
        ? "Qkiki Boost active"
        : usage.planType === "PRO"
          ? "Qkiki Pro plan"
          : usage.planType === "STARTER"
            ? "Qkiki Starter plan"
            : usage.planType === "TEAM"
              ? "Qkiki Team plan"
              : "Qkiki free usage";

  const primary =
    language === "ko"
      ? `오늘 남은 실행량: ${usage.remaining} / ${limitLabel}`
      : `Remaining today: ${usage.remaining} / ${limitLabel}`;

  const secondary =
    language === "ko"
      ? usage.isBoostActive
        ? `Boost 종료까지 ${usage.boostDaysRemaining}일 남았어요.`
        : usage.planType === "FREE"
          ? "무료 사용자는 하루 10회까지 여러 AI 모델을 비교할 수 있어요."
          : `오늘 사용량: ${used} / ${limitLabel}`
      : usage.isBoostActive
        ? `${usage.boostDaysRemaining} day(s) left in Boost.`
        : usage.planType === "FREE"
          ? "Free users can compare multiple AI models up to 10 times per day."
          : `Used today: ${used} / ${limitLabel}`;

  const guidance =
    language === "ko"
      ? "실행 전 예상 단계 수를 먼저 확인하세요. 반복 구간과 긴 첨부가 있으면 실제 사용량이 더 커질 수 있습니다."
      : "Check the planned step count before you run. Repeat blocks and large attachments can increase actual usage.";

  const warning =
    usage.isLimitReached
      ? language === "ko"
        ? usage.isBoostActive
          ? "오늘 Boost 사용량을 모두 사용했어요."
          : "오늘 사용량을 모두 사용했어요."
        : "Today's usage has been exhausted."
      : usage.warningThresholdReached
        ? language === "ko"
          ? `오늘 사용량이 거의 다 찼어요. 남은 실행량: ${usage.remaining}`
          : `You're close to today's limit. Remaining: ${usage.remaining}`
        : null;

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
        <div className="grid min-w-52 grid-cols-3 gap-2 text-sm">
          <div className="rounded-lg border border-stone-200 bg-[#fbfcf8] px-3 py-2">
            <p className="text-xs text-stone-500">
              {language === "ko" ? "남음" : "Remaining"}
            </p>
            <p className="mt-1 font-semibold text-stone-950">
              {language === "ko"
                ? `${usage.remaining}회`
                : `${usage.remaining} uses`}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-[#fbfcf8] px-3 py-2">
            <p className="text-xs text-stone-500">
              {language === "ko" ? "사용" : "Used"}
            </p>
            <p className="mt-1 font-semibold text-stone-950">
              {language === "ko" ? `${used}회` : `${used} uses`}
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-[#fbfcf8] px-3 py-2">
            <p className="text-xs text-stone-500">
              {language === "ko" ? "한도" : "Limit"}
            </p>
            <p className="mt-1 font-semibold text-stone-950">
              {usage.isUnlimitedDaily
                ? limitLabel
                : language === "ko"
                  ? `${usage.dailyLimit}회`
                  : `${usage.dailyLimit} uses`}
            </p>
          </div>
        </div>
      </div>

      {warning ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
          {warning}
        </div>
      ) : null}

      <div className="mt-4 rounded-lg border border-stone-200 bg-[#fbfcf8] px-3 py-3 text-xs leading-5 text-stone-600">
        {guidance}
      </div>

      <p className="mt-4 text-xs text-stone-500">
        {language === "ko" ? "다음 초기화" : "Next reset"}:{" "}
        {formatResetAt(usage.resetAt, language)}
      </p>
    </section>
  );
}
