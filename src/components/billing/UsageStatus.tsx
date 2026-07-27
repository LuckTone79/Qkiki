"use client";

import {
  localize,
  useLanguage,
  type AppLanguage,
} from "@/components/i18n/LanguageProvider";
import type { UsageStatus as UsageStatusType } from "@/lib/usage-types";

const DATE_LOCALES: Record<AppLanguage, string> = {
  en: "en-US",
  ko: "ko-KR",
  ja: "ja-JP",
  es: "es-ES",
};

function formatResetAt(value: string, language: AppLanguage) {
  return new Intl.DateTimeFormat(DATE_LOCALES[language], {
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
  const locale = DATE_LOCALES[language];
  const creditUnit = localize(language, {
    en: "credits",
    ko: "크레딧",
    ja: "クレジット",
    es: "créditos",
  });

  const title = usage.isAnonymous
    ? localize(language, {
        en: "Yapp trial (signed out)",
        ko: "Yapp 체험 (비로그인)",
        ja: "Yapp トライアル（未ログイン）",
        es: "Prueba de Yapp (sin sesión)",
      })
    : usage.isBoostActive
      ? localize(language, {
          en: "Yapp Boost active",
          ko: "Yapp Boost 사용 중",
          ja: "Yapp Boost 利用中",
          es: "Yapp Boost activo",
        })
      : usage.planType === "PRO"
        ? localize(language, {
            en: "Yapp Pro plan",
            ko: "Yapp Pro 플랜",
            ja: "Yapp Pro プラン",
            es: "Plan Yapp Pro",
          })
        : usage.planType === "STARTER"
          ? localize(language, {
              en: "Yapp Starter plan",
              ko: "Yapp Starter 플랜",
              ja: "Yapp Starter プラン",
              es: "Plan Yapp Starter",
            })
          : usage.planType === "TEAM"
            ? localize(language, {
                en: "Yapp Team plan",
                ko: "Yapp Team 플랜",
                ja: "Yapp Team プラン",
                es: "Plan Yapp Team",
              })
            : localize(language, {
                en: "Yapp free usage",
                ko: "Yapp 무료 사용량",
                ja: "Yapp 無料利用枠",
                es: "Uso gratuito de Yapp",
              });

  const creditsAmount = usage.totalCreditsAvailable.toLocaleString(locale);
  const primary = usage.isUnlimitedCredits
    ? localize(language, {
        en: "Credits available: Unlimited",
        ko: "남은 크레딧: 무제한",
        ja: "残りクレジット: 無制限",
        es: "Créditos disponibles: Ilimitados",
      })
    : localize(language, {
        en: `Credits available: ${creditsAmount} ${creditUnit}`,
        ko: `남은 크레딧: ${creditsAmount} ${creditUnit}`,
        ja: `残りクレジット: ${creditsAmount} ${creditUnit}`,
        es: `Créditos disponibles: ${creditsAmount} ${creditUnit}`,
      });

  const dailyCap = usage.dailyCreditLimit.toLocaleString(locale);
  const dailyLeft = usage.totalDailyCreditsAvailable.toLocaleString(locale);
  const secondary = usage.isAnonymous
    ? localize(language, {
        en: `Signed-out visitors get ${dailyCap} credits/day. Sign in to get 70 credits/day.`,
        ko: `비로그인은 하루 ${dailyCap}크레딧입니다. 로그인하면 하루 70크레딧이 적용돼요.`,
        ja: `未ログインの訪問者は1日 ${dailyCap} クレジットです。ログインすると1日70クレジットになります。`,
        es: `Los visitantes sin sesión reciben ${dailyCap} créditos/día. Inicia sesión para obtener 70 créditos/día.`,
      })
    : usage.isUnlimitedCredits
      ? localize(language, {
          en: "An unlimited-credit coupon is active.",
          ko: "무제한 크레딧 쿠폰이 적용 중이에요.",
          ja: "無制限クレジットのクーポンが適用中です。",
          es: "Hay un cupón de créditos ilimitados activo.",
        })
      : usage.isBoostActive
        ? localize(language, {
            en: `${usage.boostDaysRemaining} day(s) left in Boost.`,
            ko: `Boost 종료까지 ${usage.boostDaysRemaining}일 남았어요.`,
            ja: `Boost 終了まであと ${usage.boostDaysRemaining} 日です。`,
            es: `Quedan ${usage.boostDaysRemaining} día(s) de Boost.`,
          })
        : localize(language, {
            en: `Today ${dailyLeft} left / daily cap ${dailyCap}`,
            ko: `오늘 남은 크레딧 ${dailyLeft} / 일일 한도 ${dailyCap}`,
            ja: `本日の残り ${dailyLeft} / 1日の上限 ${dailyCap}`,
            es: `Hoy quedan ${dailyLeft} / límite diario ${dailyCap}`,
          });

  const guidance = localize(language, {
    en: "Check the estimated credits before you run. Repeat blocks, large attachments, and image generation consume credits faster.",
    ko: "실행 전 예상 크레딧을 먼저 확인하세요. 반복 구간·긴 첨부·이미지 생성은 크레딧을 더 빠르게 소모합니다.",
    ja: "実行前に予想クレジットを確認してください。繰り返し区間・大きな添付・画像生成はクレジットをより速く消費します。",
    es: "Revisa los créditos estimados antes de ejecutar. Los bloques de repetición, los adjuntos grandes y la generación de imágenes consumen créditos más rápido.",
  });

  const warning =
    !usage.isUnlimitedCredits && usage.isCreditLimitReached
      ? localize(language, {
          en: "Available credits have been exhausted.",
          ko: "사용 가능한 크레딧을 모두 사용했어요.",
          ja: "利用可能なクレジットをすべて使い切りました。",
          es: "Se han agotado los créditos disponibles.",
        })
      : !usage.isUnlimitedCredits && usage.warningThresholdReached
        ? localize(language, {
            en: `You're close to the limit. Credits left: ${creditsAmount}`,
            ko: `크레딧이 거의 다 찼어요. 남은 크레딧: ${creditsAmount}`,
            ja: `上限に近づいています。残りクレジット: ${creditsAmount}`,
            es: `Estás cerca del límite. Créditos restantes: ${creditsAmount}`,
          })
        : null;

  const cards: { label: string; value: string }[] = [
    {
      label: localize(language, {
        en: "Month credits",
        ko: "월 크레딧",
        ja: "月間クレジット",
        es: "Créditos del mes",
      }),
      value: usage.isUnlimitedCredits
        ? "∞"
        : usage.monthlyCreditsRemaining.toLocaleString(locale),
    },
    {
      label: localize(language, {
        en: "Today left",
        ko: "오늘 남은",
        ja: "本日の残り",
        es: "Restante hoy",
      }),
      value: usage.isUnlimitedCredits
        ? "∞"
        : usage.totalDailyCreditsAvailable.toLocaleString(locale),
    },
    {
      label: localize(language, {
        en: "Daily cap",
        ko: "일일 한도",
        ja: "1日の上限",
        es: "Límite diario",
      }),
      value: usage.isUnlimitedCredits
        ? "∞"
        : usage.dailyCreditLimit.toLocaleString(locale),
    },
    {
      label: localize(language, {
        en: "Coupon",
        ko: "쿠폰",
        ja: "クーポン",
        es: "Cupón",
      }),
      value: usage.couponCreditBalance.toLocaleString(locale),
    },
    {
      label: localize(language, {
        en: "Wallet",
        ko: "지갑",
        ja: "ウォレット",
        es: "Billetera",
      }),
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
              className="rounded-lg border border-stone-200 bg-[#f4f5f6] px-3 py-2"
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

      <div className="mt-4 rounded-lg border border-stone-200 bg-[#f4f5f6] px-3 py-3 text-xs leading-5 text-stone-600">
        {guidance}
      </div>

      <p className="mt-4 text-xs text-stone-500">
        {localize(language, {
          en: "Next reset",
          ko: "다음 초기화",
          ja: "次回リセット",
          es: "Próximo reinicio",
        })}
        :{" "}
        {formatResetAt(usage.resetAt, language)}
      </p>
    </section>
  );
}
