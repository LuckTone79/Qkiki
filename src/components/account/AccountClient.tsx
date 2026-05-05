"use client";

import { FormEvent, useState } from "react";
import { useEffect } from "react";
import { SectionHeader } from "@/components/SectionHeader";
import { SignOutButton } from "@/components/SignOutButton";
import { useLanguage } from "@/components/i18n/LanguageProvider";

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
  const [subscription, setSubscription] = useState<{
    isLifetime: boolean;
    planEndsAt: string | null;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function loadSubscription() {
    const response = await fetch("/api/subscription");
    const data = (await response.json().catch(() => ({}))) as {
      subscription?: {
        isLifetime: boolean;
        planEndsAt: string | null;
      };
    };

    if (response.ok && data.subscription) {
      setSubscription(data.subscription);
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
    </div>
  );
}
