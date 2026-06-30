"use client";

import { type AppLanguage } from "@/lib/i18n";

import { localize } from "@/lib/i18n";

import { FormEvent, useState } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { UsageStatus } from "@/components/billing/UsageStatus";
import { SectionHeader } from "@/components/SectionHeader";
import { SignOutButton } from "@/components/SignOutButton";
import { useLanguage } from "@/components/i18n/LanguageProvider";
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
    return localize(language, { en: coupon.isLifetime
        ? "Lifetime unlimited credits"
        : "Unlimited credits", ko: coupon.isLifetime
        ? "평생 무제한 크레딧"
        : "무제한 크레딧", ja: coupon.isLifetime ? "\u751F\u6DAF\u7121\u5236\u9650\u306E\u30AF\u30EC\u30B8\u30C3\u30C8" : "\u7121\u5236\u9650\u306E\u30AF\u30EC\u30B8\u30C3\u30C8", es: coupon.isLifetime ? "Cr\u00E9ditos ilimitados de por vida" : "Cr\u00E9ditos ilimitados" });
  }
  return localize(language, { en: coupon.isLifetime
      ? "Lifetime credits"
      : "Credit coupon", ko: coupon.isLifetime
      ? "평생 크레딧"
      : "크레딧 쿠폰", ja: coupon.isLifetime ? "\u751F\u6DAF\u30AF\u30EC\u30B8\u30C3\u30C8" : "\u30AF\u30EC\u30B8\u30C3\u30C8\u30AF\u30FC\u30DD\u30F3", es: coupon.isLifetime ? "Cr\u00E9ditos de por vida" : "Cup\u00F3n de cr\u00E9dito" });
}

function formatCouponDate(value: string | null, language: AppLanguage) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat(localize(language, { en: "en-US", ko: "ko-KR", ja: "en-US", es: "en-US" }), {
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
        localize(language, { en: data.error || t("couldNotUpdateAccount"), ko: t("couldNotUpdateAccount"), ja: data.error || t("couldNotUpdateAccount"), es: data.error || t("couldNotUpdateAccount") }),
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
      setError(data.error || (localize(language, { en: "Coupon redemption failed.", ko: "쿠폰 적용에 실패했습니다.", ja: "\u30AF\u30FC\u30DD\u30F3\u306E\u5F15\u304D\u63DB\u3048\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002", es: "Error al canjear el cup\u00F3n." })));
      setRedeemingCoupon(false);
      return;
    }

    if (data.note === "already_lifetime") {
      setNotice(
        localize(language, { en: "Already lifetime free. Redemption was recorded.", ko: "이미 평생 무료 상태입니다. 사용 기록만 남겼습니다.", ja: "\u3059\u3067\u306B\u751F\u6DAF\u7121\u6599\u3067\u3059\u3002\u511F\u9084\u304C\u8A18\u9332\u3055\u308C\u307E\u3057\u305F\u3002", es: "Ya gratis de por vida. Se registr\u00F3 la redenci\u00F3n." }),
      );
    } else {
      setNotice(localize(language, { en: "Coupon applied.", ko: "쿠폰이 적용되었습니다.", ja: "\u30AF\u30FC\u30DD\u30F3\u304C\u9069\u7528\u3055\u308C\u307E\u3057\u305F\u3002", es: "Cup\u00F3n aplicado." }));
    }

    setCouponCode("");
    setRedeemingCoupon(false);
    await loadSubscription();
  }

  useEffect(() => {
    loadSubscription();
  }, []);

  const planLabel = subscription?.isLifetime
    ? localize(language, { en: "Lifetime free", ko: "평생 무료", ja: "\u751F\u6DAF\u7121\u6599", es: "Gratis de por vida" })
    : subscription?.planEndsAt
      ? localize(language, { en: `Free plan ends: ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(subscription.planEndsAt))}`, ko: `무료 이용 종료: ${new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(subscription.planEndsAt))}`, ja: `\u7121\u6599\u30D7\u30E9\u30F3\u306E\u7D42\u4E86:${new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(subscription.planEndsAt))}`, es: `El plan gratuito finaliza:${new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(subscription.planEndsAt))}` })
      : localize(language, { en: "No active free plan", ko: "이용권 없음", ja: "\u30A2\u30AF\u30C6\u30A3\u30D6\u306A\u7121\u6599\u30D7\u30E9\u30F3\u306F\u3042\u308A\u307E\u305B\u3093", es: "No hay plan gratuito activo" });

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
                ? (localize(language, { en: "Saving…", ko: "저장 중…", ja: "\u4FDD\u5B58\u4E2D\u2026", es: "Guardando\u2026" }))
                : accountSavedAt
                  ? (localize(language, { en: "Saved ✓", ko: "저장됨 ✓", ja: "\u4FDD\u5B58\u6E08\u307F \u2713", es: "Guardado \u2713" }))
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
          {localize(language, { en: "Plan and coupons", ko: "이용권 및 쿠폰", ja: "\u30D7\u30E9\u30F3\u3068\u30AF\u30FC\u30DD\u30F3", es: "Plan y cupones" })}
        </h2>
        <p className="mt-1 text-sm text-stone-600">{planLabel}</p>
        {subscription?.activeCoupon ? (
          <div className="mt-3 rounded-md border border-teal-200 bg-teal-50 px-3 py-3 text-sm text-teal-900">
            <p className="font-semibold">
              {localize(language, { en: "Active coupon", ko: "적용된 쿠폰", ja: "\u30A2\u30AF\u30C6\u30A3\u30D6\u306A\u30AF\u30FC\u30DD\u30F3", es: "Cup\u00F3n activo" })}:{" "}
              {activeCouponLabel(subscription.activeCoupon, language)}
            </p>
            {subscription.activeCoupon.kind === "credit" &&
            subscription.activeCoupon.creditAmount ? (
              <p className="mt-1">
                {localize(language, { en: "Credit balance", ko: "남은 크레딧", ja: "\u4FE1\u7528\u6B8B\u9AD8", es: "Saldo crediticio" })}:{" "}
                {subscription.activeCoupon.creditAmount.toLocaleString(
                  localize(language, { en: "en-US", ko: "ko-KR", ja: "en-US", es: "en-US" }),
                )}
              </p>
            ) : null}
            <p className="mt-1">
              {localize(language, { en: "Applied", ko: "적용일", ja: "\u9069\u7528\u6E08\u307F", es: "Aplicado" })}:{" "}
              {formatCouponDate(subscription.activeCoupon.appliedAt, language)}
            </p>
            <p className="mt-1">
              {localize(language, { en: "Expires", ko: "만료일", ja: "\u6709\u52B9\u671F\u9650\u304C\u5207\u308C\u307E\u3059", es: "Vence" })}:{" "}
              {subscription.activeCoupon.isLifetime
                ? localize(language, { en: "Never (lifetime)", ko: "무기한 (평생)", ja: "\u6C7A\u3057\u3066\uFF08\u751F\u6DAF\uFF09", es: "Nunca (de por vida)" })
                : formatCouponDate(subscription.activeCoupon.expiresAt, language)}
            </p>
          </div>
        ) : subscription?.couponStatus === "DEACTIVATED" ? (
          <p className="mt-2 text-sm font-semibold text-rose-700">
            {localize(language, { en: "Coupon deactivated", ko: "쿠폰 비활성화", ja: "\u30AF\u30FC\u30DD\u30F3\u304C\u7121\u52B9\u306B\u306A\u308A\u307E\u3057\u305F", es: "Cup\u00F3n desactivado" })}
          </p>
        ) : null}
        <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
          <Link
            href="/app/pricing?intent=monthly"
            className="rounded-md bg-stone-950 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-stone-800"
          >
            {localize(language, { en: "Start monthly plan", ko: "월구독 시작하기", ja: "\u6708\u984D\u30D7\u30E9\u30F3\u3092\u59CB\u3081\u308B", es: "Iniciar plan mensual" })}
          </Link>
          <Link
            href="/app/pricing?intent=yearly"
            className="rounded-md border border-stone-300 px-4 py-2 text-center text-sm font-semibold text-stone-700 hover:bg-stone-50"
          >
            {localize(language, { en: "Get yearly discount", ko: "연구독으로 할인받기", ja: "\u5E74\u9593\u5272\u5F15\u3092\u53D7\u3051\u308B", es: "Obt\u00E9n descuento anual" })}
          </Link>
          <Link
            href="/app/pricing?intent=credit"
            className="rounded-md border border-stone-300 px-4 py-2 text-center text-sm font-semibold text-stone-700 hover:bg-stone-50"
          >
            {localize(language, { en: "Buy credit pack", ko: "필요한 만큼만 충전하기", ja: "\u30AF\u30EC\u30B8\u30C3\u30C8\u30D1\u30C3\u30AF\u3092\u8CFC\u5165\u3059\u308B", es: "Comprar paquete de cr\u00E9ditos" })}
          </Link>
        </div>

        <form onSubmit={redeemCoupon} className="mt-4 space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-stone-700">
              {localize(language, { en: "Coupon code", ko: "쿠폰 코드", ja: "\u30AF\u30FC\u30DD\u30F3\u30B3\u30FC\u30C9", es: "c\u00F3digo de cup\u00F3n" })}
            </span>
            <input
              value={couponCode}
              onChange={(event) => setCouponCode(event.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
              placeholder={localize(language, { en: "e.g. M30-ABCDEFGHJK", ko: "예: M30-ABCDEFGHJK", ja: "\u4F8B\u3048\u3070M30-ABCDEFGHJK", es: "p.ej. M30-ABCDEFGHJK" })}
            />
          </label>
          <button
            type="submit"
            disabled={redeemingCoupon}
            className="w-full rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {redeemingCoupon
              ? (localize(language, { en: "Redeeming…", ko: "등록 중…", ja: "\u5F15\u304D\u63DB\u3048\u4E2D\u2026", es: "Redentor\u2026" }))
              : (localize(language, { en: "Redeem coupon", ko: "쿠폰 등록", ja: "\u30AF\u30FC\u30DD\u30F3\u3092\u5F15\u304D\u63DB\u3048\u308B", es: "Canjear cup\u00F3n" }))}
          </button>
        </form>
      </section>

      <section className="max-w-xl rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-stone-950">
          {localize(language, { en: "Feedback board", ko: "피드백 게시판", ja: "\u30D5\u30A3\u30FC\u30C9\u30D0\u30C3\u30AF\u30DC\u30FC\u30C9", es: "Tablero de comentarios" })}
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          {localize(language, { en: "Report problems or suggest improvements. Only you and the Yapp team can see your posts, and you can attach screenshots.", ko: "불편 사항이나 개선 제안을 남겨주세요. 작성한 글은 본인과 운영팀만 볼 수 있으며, 캡처 이미지도 첨부할 수 있습니다.", ja: "\u554F\u984C\u3092\u5831\u544A\u3057\u305F\u308A\u3001\u6539\u5584\u3092\u63D0\u6848\u3057\u305F\u308A\u3067\u304D\u307E\u3059\u3002\u3042\u306A\u305F\u3068 Yapp \u30C1\u30FC\u30E0\u3060\u3051\u304C\u3042\u306A\u305F\u306E\u6295\u7A3F\u3092\u898B\u308B\u3053\u3068\u304C\u3067\u304D\u3001\u30B9\u30AF\u30EA\u30FC\u30F3\u30B7\u30E7\u30C3\u30C8\u3092\u6DFB\u4ED8\u3059\u308B\u3053\u3068\u304C\u3067\u304D\u307E\u3059\u3002", es: "Informar problemas o sugerir mejoras. Solo usted y el equipo de Yapp pueden ver sus publicaciones y pueden adjuntar capturas de pantalla." })}
        </p>
        <div className="mt-4">
          <Link
            href="/app/account/feedback"
            className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            {localize(language, { en: "Open feedback board", ko: "피드백 게시판 열기", ja: "\u30D5\u30A3\u30FC\u30C9\u30D0\u30C3\u30AF\u30DC\u30FC\u30C9\u3092\u958B\u304F", es: "Abrir tablero de comentarios" })}
          </Link>
        </div>
      </section>

      {usage ? <UsageStatus usage={usage} /> : null}
    </div>
  );
}
