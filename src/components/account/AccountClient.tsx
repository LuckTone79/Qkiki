"use client";

import { FormEvent, useState } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { UsageStatus } from "@/components/billing/UsageStatus";
import { SectionHeader } from "@/components/SectionHeader";
import { SignOutButton } from "@/components/SignOutButton";
import {
  intlLocale,
  localize,
  useLanguage,
  type AppLanguage,
} from "@/components/i18n/LanguageProvider";
import { readUsageCache, writeUsageCache } from "@/lib/local-cache";
import type { UsageStatus as UsageStatusType } from "@/lib/usage-types";

type ActiveCoupon = {
  kind: "credit" | "unlimited";
  type: string | null;
  creditAmount: number | null;
  appliedAt: string | null;
  expiresAt: string | null;
  isLifetime: boolean;
};

type SubscriptionState = {
  isLifetime: boolean;
  planEndsAt: string | null;
  couponStatus: "DEACTIVATED" | null;
  activeCoupon: ActiveCoupon | null;
};

function activeCouponLabel(coupon: ActiveCoupon, language: AppLanguage) {
  if (coupon.kind === "unlimited") {
    return coupon.isLifetime
      ? localize(language, {
          en: "Lifetime unlimited credits",
          ko: "평생 무제한 크레딧",
          ja: "永久無制限クレジット",
          es: "Créditos ilimitados de por vida",
        })
      : localize(language, {
          en: "Unlimited credits",
          ko: "무제한 크레딧",
          ja: "無制限クレジット",
          es: "Créditos ilimitados",
        });
  }
  return coupon.isLifetime
    ? localize(language, {
        en: "Lifetime credits",
        ko: "평생 크레딧",
        ja: "永久クレジット",
        es: "Créditos de por vida",
      })
    : localize(language, {
        en: "Credit coupon",
        ko: "크레딧 쿠폰",
        ja: "クレジットクーポン",
        es: "Cupón de créditos",
      });
}

function formatCouponDate(value: string | null, language: AppLanguage) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat(intlLocale(language), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AccountClient({
  initialName,
  email,
}: {
  initialName: string;
  email: string;
}) {
  const { language, t } = useLanguage();
  const [name, setName] = useState(initialName);
  const [couponCode, setCouponCode] = useState("");
  const [subscription, setSubscription] = useState<SubscriptionState | null>(
    null,
  );
  const [usage, setUsage] = useState<UsageStatusType | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountSavedAt, setAccountSavedAt] = useState<number | null>(null);
  const [redeemingCoupon, setRedeemingCoupon] = useState(false);

  async function loadSubscription() {
    const cachedUsage = readUsageCache<UsageStatusType>();
    if (cachedUsage) {
      setUsage(cachedUsage.data);
    }

    const responsePromise = fetch("/api/subscription");
    const usageResponsePromise = cachedUsage ? null : fetch("/api/usage");
    const response = await responsePromise;
    const usageResponse = usageResponsePromise
      ? await usageResponsePromise
      : null;
    const data = (await response.json().catch(() => ({}))) as {
      subscription?: SubscriptionState;
    };
    const usageData = usageResponse
      ? ((await usageResponse.json().catch(() => ({}))) as {
      usage?: UsageStatusType;
        })
      : null;

    if (response.ok && data.subscription) {
      setSubscription(data.subscription);
    }
    if (usageResponse?.ok && usageData?.usage) {
      setUsage(usageData.usage);
      writeUsageCache(usageData.usage);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (savingAccount) return;
    setNotice("");
    setError("");
    setSavingAccount(true);

    const response = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };

    if (!response.ok) {
      setError(
        language === "en"
          ? data.error || t("couldNotUpdateAccount")
          : t("couldNotUpdateAccount"),
      );
      setSavingAccount(false);
      return;
    }

    setNotice(t("accountUpdated"));
    setAccountSavedAt(Date.now());
    setTimeout(() => setAccountSavedAt(null), 2000);
    setSavingAccount(false);
  }

  async function redeemCoupon(event: FormEvent) {
    event.preventDefault();
    if (redeemingCoupon) return;
    setNotice("");
    setError("");
    setRedeemingCoupon(true);

    const response = await fetch("/api/coupons/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: couponCode }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      result?: string;
      note?: string | null;
    };

    if (!response.ok) {
      setError(
        data.error ||
          localize(language, {
            en: "Coupon redemption failed.",
            ko: "쿠폰 적용에 실패했습니다.",
            ja: "クーポンの適用に失敗しました。",
            es: "La aplicación del cupón falló.",
          }),
      );
      setRedeemingCoupon(false);
      return;
    }

    if (data.note === "already_lifetime") {
      setNotice(
        localize(language, {
          en: "Already lifetime free. Redemption was recorded.",
          ko: "이미 평생 무료 상태입니다. 사용 기록만 남겼습니다.",
          ja: "すでに永久無料です。利用記録のみ残しました。",
          es: "Ya tienes acceso gratuito de por vida. Se registró el canje.",
        }),
      );
    } else {
      setNotice(
        localize(language, {
          en: "Coupon applied.",
          ko: "쿠폰이 적용되었습니다.",
          ja: "クーポンを適用しました。",
          es: "Cupón aplicado.",
        }),
      );
    }

    setCouponCode("");
    setRedeemingCoupon(false);
    await loadSubscription();
  }

  useEffect(() => {
    loadSubscription();
  }, []);

  const planEndDate = subscription?.planEndsAt
    ? new Intl.DateTimeFormat(intlLocale(language), {
        dateStyle: "medium",
      }).format(new Date(subscription.planEndsAt))
    : "";
  const planLabel = subscription?.isLifetime
    ? localize(language, {
        en: "Lifetime free",
        ko: "평생 무료",
        ja: "永久無料",
        es: "Gratis de por vida",
      })
    : subscription?.planEndsAt
      ? localize(language, {
          en: `Free plan ends: ${planEndDate}`,
          ko: `무료 이용 종료: ${planEndDate}`,
          ja: `無料プラン終了: ${planEndDate}`,
          es: `El plan gratuito termina: ${planEndDate}`,
        })
      : localize(language, {
          en: "No active free plan",
          ko: "이용권 없음",
          ja: "有効な無料プランがありません",
          es: "Sin plan gratuito activo",
        });

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow={t("account")}
        title={t("accountTitle")}
        description={t("accountDescription")}
      />

      {notice ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <section className="max-w-xl rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-stone-700">
              {t("name")}
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
              placeholder={t("yourName")}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-stone-700">
              {t("email")}
            </span>
            <input
              value={email}
              disabled
              className="mt-1 w-full rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-500"
            />
          </label>
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <button
              type="submit"
              disabled={savingAccount}
              className={`w-full rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed sm:w-auto ${accountSavedAt ? "bg-teal-600" : "bg-stone-950 hover:bg-stone-800 disabled:opacity-60"}`}
            >
              {savingAccount
                ? localize(language, {
                    en: "Saving…",
                    ko: "저장 중…",
                    ja: "保存中…",
                    es: "Guardando…",
                  })
                : accountSavedAt
                  ? localize(language, {
                      en: "Saved ✓",
                      ko: "저장됨 ✓",
                      ja: "保存しました ✓",
                      es: "Guardado ✓",
                    })
                  : t("saveAccount")}
            </button>
            <div className="w-full sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">
              <SignOutButton />
            </div>
          </div>
        </form>
      </section>

      <section className="max-w-xl rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-stone-950">
          {localize(language, {
            en: "Plan and coupons",
            ko: "이용권 및 쿠폰",
            ja: "プランとクーポン",
            es: "Plan y cupones",
          })}
        </h2>
        <p className="mt-1 text-sm text-stone-600">{planLabel}</p>
        {subscription?.activeCoupon ? (
          <div className="mt-3 rounded-md border border-teal-200 bg-teal-50 px-3 py-3 text-sm text-teal-900">
            <p className="font-semibold">
              {localize(language, {
                en: "Active coupon",
                ko: "적용된 쿠폰",
                ja: "適用中のクーポン",
                es: "Cupón activo",
              })}
              : {activeCouponLabel(subscription.activeCoupon, language)}
            </p>
            {subscription.activeCoupon.kind === "credit" &&
            subscription.activeCoupon.creditAmount ? (
              <p className="mt-1">
                {localize(language, {
                  en: "Credit balance",
                  ko: "남은 크레딧",
                  ja: "残りクレジット",
                  es: "Saldo de créditos",
                })}
                :{" "}
                {subscription.activeCoupon.creditAmount.toLocaleString(
                  intlLocale(language),
                )}
              </p>
            ) : null}
            <p className="mt-1">
              {localize(language, {
                en: "Applied",
                ko: "적용일",
                ja: "適用日",
                es: "Aplicado",
              })}
              : {formatCouponDate(subscription.activeCoupon.appliedAt, language)}
            </p>
            <p className="mt-1">
              {localize(language, {
                en: "Expires",
                ko: "만료일",
                ja: "有効期限",
                es: "Expira",
              })}
              :{" "}
              {subscription.activeCoupon.isLifetime
                ? localize(language, {
                    en: "Never (lifetime)",
                    ko: "무기한 (평생)",
                    ja: "無期限（永久）",
                    es: "Nunca (de por vida)",
                  })
                : formatCouponDate(subscription.activeCoupon.expiresAt, language)}
            </p>
          </div>
        ) : subscription?.couponStatus === "DEACTIVATED" ? (
          <p className="mt-2 text-sm font-semibold text-rose-700">
            {localize(language, {
              en: "Coupon deactivated",
              ko: "쿠폰 비활성화",
              ja: "クーポンが無効化されました",
              es: "Cupón desactivado",
            })}
          </p>
        ) : null}
        <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
          <Link
            href="/app/pricing?intent=monthly"
            className="rounded-md bg-stone-950 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-stone-800"
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
            className="rounded-md border border-stone-300 px-4 py-2 text-center text-sm font-semibold text-stone-700 hover:bg-stone-50"
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
            className="rounded-md border border-stone-300 px-4 py-2 text-center text-sm font-semibold text-stone-700 hover:bg-stone-50"
          >
            {localize(language, {
              en: "Buy credit pack",
              ko: "필요한 만큼만 충전하기",
              ja: "クレジットパックを購入",
              es: "Comprar paquete de créditos",
            })}
          </Link>
        </div>

        <form onSubmit={redeemCoupon} className="mt-4 space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-stone-700">
              {localize(language, {
                en: "Coupon code",
                ko: "쿠폰 코드",
                ja: "クーポンコード",
                es: "Código de cupón",
              })}
            </span>
            <input
              value={couponCode}
              onChange={(event) => setCouponCode(event.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
              placeholder={localize(language, {
                en: "e.g. M30-ABCDEFGHJK",
                ko: "예: M30-ABCDEFGHJK",
                ja: "例: M30-ABCDEFGHJK",
                es: "p. ej. M30-ABCDEFGHJK",
              })}
            />
          </label>
          <button
            type="submit"
            disabled={redeemingCoupon}
            className="w-full rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {redeemingCoupon
              ? localize(language, {
                  en: "Redeeming…",
                  ko: "등록 중…",
                  ja: "登録中…",
                  es: "Canjeando…",
                })
              : localize(language, {
                  en: "Redeem coupon",
                  ko: "쿠폰 등록",
                  ja: "クーポンを登録",
                  es: "Canjear cupón",
                })}
          </button>
        </form>
      </section>

      <section className="max-w-xl rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-stone-950">
          {localize(language, {
            en: "Feedback board",
            ko: "피드백 게시판",
            ja: "フィードバックボード",
            es: "Tablero de comentarios",
          })}
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          {localize(language, {
            en: "Report problems or suggest improvements. Only you and the Yapp team can see your posts, and you can attach screenshots.",
            ko: "불편 사항이나 개선 제안을 남겨주세요. 작성한 글은 본인과 운영팀만 볼 수 있으며, 캡처 이미지도 첨부할 수 있습니다.",
            ja: "問題の報告や改善の提案をお寄せください。投稿はご本人と運営チームのみが閲覧でき、スクリーンショットも添付できます。",
            es: "Informa problemas o sugiere mejoras. Solo tú y el equipo de Yapp pueden ver tus publicaciones, y puedes adjuntar capturas de pantalla.",
          })}
        </p>
        <div className="mt-4">
          <Link
            href="/app/account/feedback"
            className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            {localize(language, {
              en: "Open feedback board",
              ko: "피드백 게시판 열기",
              ja: "フィードバックボードを開く",
              es: "Abrir tablero de comentarios",
            })}
          </Link>
        </div>
      </section>

      {usage ? <UsageStatus usage={usage} /> : null}
    </div>
  );
}
