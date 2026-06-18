"use client";

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

function activeCouponLabel(coupon: ActiveCoupon, language: "en" | "ko") {
  if (coupon.kind === "unlimited") {
    return language === "ko"
      ? coupon.isLifetime
        ? "평생 무제한 크레딧"
        : "무제한 크레딧"
      : coupon.isLifetime
        ? "Lifetime unlimited credits"
        : "Unlimited credits";
  }
  return language === "ko"
    ? coupon.isLifetime
      ? "평생 크레딧"
      : "크레딧 쿠폰"
    : coupon.isLifetime
      ? "Lifetime credits"
      : "Credit coupon";
}

function formatCouponDate(value: string | null, language: "en" | "ko") {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat(language === "ko" ? "ko-KR" : "en-US", {
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
    setNotice("");
    setError("");

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
        language === "ko"
          ? t("couldNotUpdateAccount")
          : data.error || t("couldNotUpdateAccount"),
      );
      return;
    }

    setNotice(t("accountUpdated"));
  }

  async function redeemCoupon(event: FormEvent) {
    event.preventDefault();
    setNotice("");
    setError("");

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
      setError(data.error || (language === "ko" ? "쿠폰 적용에 실패했습니다." : "Coupon redemption failed."));
      return;
    }

    if (data.note === "already_lifetime") {
      setNotice(
        language === "ko"
          ? "이미 평생 무료 상태입니다. 사용 기록만 남겼습니다."
          : "Already lifetime free. Redemption was recorded.",
      );
    } else {
      setNotice(language === "ko" ? "쿠폰이 적용되었습니다." : "Coupon applied.");
    }

    setCouponCode("");
    await loadSubscription();
  }

  useEffect(() => {
    loadSubscription();
  }, []);

  const planLabel = subscription?.isLifetime
    ? language === "ko"
      ? "평생 무료"
      : "Lifetime free"
    : subscription?.planEndsAt
      ? language === "ko"
        ? `무료 이용 종료: ${new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(subscription.planEndsAt))}`
        : `Free plan ends: ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(subscription.planEndsAt))}`
      : language === "ko"
        ? "이용권 없음"
        : "No active free plan";

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
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
            >
              {t("saveAccount")}
            </button>
            <SignOutButton />
          </div>
        </form>
      </section>

      <section className="max-w-xl rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-stone-950">
          {language === "ko" ? "이용권 및 쿠폰" : "Plan and coupons"}
        </h2>
        <p className="mt-1 text-sm text-stone-600">{planLabel}</p>
        {subscription?.activeCoupon ? (
          <div className="mt-3 rounded-md border border-teal-200 bg-teal-50 px-3 py-3 text-sm text-teal-900">
            <p className="font-semibold">
              {language === "ko" ? "적용된 쿠폰" : "Active coupon"}:{" "}
              {activeCouponLabel(subscription.activeCoupon, language)}
            </p>
            {subscription.activeCoupon.kind === "credit" &&
            subscription.activeCoupon.creditAmount ? (
              <p className="mt-1">
                {language === "ko" ? "남은 크레딧" : "Credit balance"}:{" "}
                {subscription.activeCoupon.creditAmount.toLocaleString(
                  language === "ko" ? "ko-KR" : "en-US",
                )}
              </p>
            ) : null}
            <p className="mt-1">
              {language === "ko" ? "적용일" : "Applied"}:{" "}
              {formatCouponDate(subscription.activeCoupon.appliedAt, language)}
            </p>
            <p className="mt-1">
              {language === "ko" ? "만료일" : "Expires"}:{" "}
              {subscription.activeCoupon.isLifetime
                ? language === "ko"
                  ? "무기한 (평생)"
                  : "Never (lifetime)"
                : formatCouponDate(subscription.activeCoupon.expiresAt, language)}
            </p>
          </div>
        ) : subscription?.couponStatus === "DEACTIVATED" ? (
          <p className="mt-2 text-sm font-semibold text-rose-700">
            {language === "ko" ? "쿠폰 비활성화" : "Coupon deactivated"}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/app/pricing?intent=monthly"
            className="rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
          >
            {language === "ko" ? "월구독 시작하기" : "Start monthly plan"}
          </Link>
          <Link
            href="/app/pricing?intent=yearly"
            className="rounded-md border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
          >
            {language === "ko" ? "연구독으로 할인받기" : "Get yearly discount"}
          </Link>
          <Link
            href="/app/pricing?intent=credit"
            className="rounded-md border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
          >
            {language === "ko" ? "필요한 만큼만 충전하기" : "Buy credit pack"}
          </Link>
        </div>

        <form onSubmit={redeemCoupon} className="mt-4 space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-stone-700">
              {language === "ko" ? "쿠폰 코드" : "Coupon code"}
            </span>
            <input
              value={couponCode}
              onChange={(event) => setCouponCode(event.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
              placeholder={language === "ko" ? "예: M30-ABCDEFGHJK" : "e.g. M30-ABCDEFGHJK"}
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
          >
            {language === "ko" ? "쿠폰 등록" : "Redeem coupon"}
          </button>
        </form>
      </section>

      <section className="max-w-xl rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-stone-950">
          {language === "ko" ? "피드백 게시판" : "Feedback board"}
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          {language === "ko"
            ? "불편 사항이나 개선 제안을 남겨주세요. 작성한 글은 본인과 운영팀만 볼 수 있으며, 캡처 이미지도 첨부할 수 있습니다."
            : "Report problems or suggest improvements. Only you and the Qkiki team can see your posts, and you can attach screenshots."}
        </p>
        <div className="mt-4">
          <Link
            href="/app/account/feedback"
            className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            {language === "ko" ? "피드백 게시판 열기" : "Open feedback board"}
          </Link>
        </div>
      </section>

      {usage ? <UsageStatus usage={usage} /> : null}
    </div>
  );
}
