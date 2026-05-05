"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type CouponItem = {
  id: string;
  code: string;
  type: "MONTHLY_FREE_30D" | "LIFETIME_FREE";
  isActive: boolean;
  redeemedAt: string | null;
  createdAt: string;
  note: string | null;
  usageStatus: "ACTIVE" | "INACTIVE" | "IN_USE" | "USED";
  createdByAdmin: {
    id: string;
    email: string;
    name: string | null;
  };
  redeemedByUser: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  appliedRedemption: {
    id: string;
    result: "APPLIED" | "ALREADY_LIFETIME";
    grantStartAt: string | null;
    grantEndAt: string | null;
    grantIsLifetime: boolean;
    createdAt: string;
  } | null;
};

const couponText = {
  en: {
    title: "Coupons",
    description:
      "Create one-time coupons for monthly free (30 days) or lifetime free plans.",
    createSectionTitle: "Create coupon",
    type: "Type",
    customCode: "Custom code (optional)",
    customCodePlaceholder: "auto-generate if empty",
    note: "Note",
    notePlaceholder: "internal memo",
    createCoupon: "Create coupon",
    creating: "Creating...",
    searchEmpty: "-",
    code: "Code",
    copied: "Code copied.",
    copy: "Copy",
    typeHeader: "Type",
    status: "Status",
    created: "Created",
    redeemedBy: "Redeemed by",
    startedAt: "Started",
    endsAt: "Ends",
    action: "Action",
    statusActive: "active",
    statusInactive: "inactive",
    statusInUse: "in use",
    statusUsed: "used",
    lifetime: "lifetime",
    couponCreated: "Coupon created",
    couponDeleted: "Coupon deleted.",
    couponDeactivated: "Coupon deactivated.",
    deactivate: "Deactivate",
    delete: "Delete",
    deleteConfirm: "Delete this coupon?",
    failedLoad: "Failed to load coupons.",
    failedCreate: "Failed to create coupon.",
    failedDeactivate: "Failed to deactivate coupon.",
    failedDelete: "Failed to delete coupon.",
    failedCopy: "Could not copy code.",
    noPeriod: "-",
    monthlyType: "monthly_free_30d",
    lifetimeType: "lifetime_free",
  },
  ko: {
    title: "\uCFE0\uD3F0",
    description:
      "30\uC77C \uBB34\uB8CC \uD50C\uB79C\uACFC \uD3C9\uC0DD \uBB34\uB8CC \uD50C\uB79C \uC6A9\uC77C\uD68C\uC6A9 \uCFE0\uD3F0\uC744 \uC0DD\uC131\uD569\uB2C8\uB2E4.",
    createSectionTitle: "\uCFE0\uD3F0 \uC0DD\uC131",
    type: "\uC720\uD615",
    customCode: "\uC9C1\uC811 \uCF54\uB4DC (\uC120\uD0DD)",
    customCodePlaceholder:
      "\uBE44\uC6CC\uB450\uBA74 \uC790\uB3D9 \uC0DD\uC131\uB429\uB2C8\uB2E4",
    note: "\uBA54\uBAA8",
    notePlaceholder: "\uB0B4\uBD80 \uBA54\uBAA8",
    createCoupon: "\uCFE0\uD3F0 \uC0DD\uC131",
    creating: "\uC0DD\uC131 \uC911...",
    searchEmpty: "-",
    code: "\uCF54\uB4DC",
    copied: "\uCF54\uB4DC\uAC00 \uBCF5\uC0AC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.",
    copy: "\uBCF5\uC0AC",
    typeHeader: "\uC720\uD615",
    status: "\uC0C1\uD0DC",
    created: "\uC0DD\uC131\uC77C",
    redeemedBy: "\uC0AC\uC6A9\uC790",
    startedAt: "\uC0AC\uC6A9 \uC2DC\uC791\uC77C",
    endsAt: "\uC885\uB8CC\uC77C",
    action: "\uC791\uC5C5",
    statusActive: "\uD65C\uC131",
    statusInactive: "\uBE44\uD65C\uC131",
    statusInUse: "\uC0AC\uC6A9 \uC911",
    statusUsed: "\uC0AC\uC6A9 \uC885\uB8CC",
    lifetime: "\uD3C9\uC0DD",
    couponCreated: "\uCFE0\uD3F0 \uC0DD\uC131 \uC644\uB8CC",
    couponDeleted: "\uCFE0\uD3F0\uC744 \uC0AD\uC81C\uD588\uC2B5\uB2C8\uB2E4.",
    couponDeactivated: "\uCFE0\uD3F0\uC744 \uBE44\uD65C\uC131\uD654\uD588\uC2B5\uB2C8\uB2E4.",
    deactivate: "\uBE44\uD65C\uC131\uD654",
    delete: "\uC0AD\uC81C",
    deleteConfirm:
      "\uC774 \uCFE0\uD3F0\uC744 \uC0AD\uC81C\uD560\uAE4C\uC694?",
    failedLoad: "\uCFE0\uD3F0\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
    failedCreate: "\uCFE0\uD3F0 \uC0DD\uC131\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.",
    failedDeactivate:
      "\uCFE0\uD3F0 \uBE44\uD65C\uC131\uD654\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.",
    failedDelete: "\uCFE0\uD3F0 \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.",
    failedCopy: "\uCF54\uB4DC \uBCF5\uC0AC\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.",
    noPeriod: "-",
    monthlyType: "monthly_free_30d",
    lifetimeType: "lifetime_free",
  },
} as const;

function statusClass(status: CouponItem["usageStatus"]) {
  if (status === "ACTIVE") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "INACTIVE") {
    return "bg-rose-100 text-rose-700";
  }
  if (status === "IN_USE") {
    return "bg-sky-100 text-sky-700";
  }
  return "bg-slate-200 text-slate-700";
}

export function AdminCouponsClient() {
  const { language } = useLanguage();
  const t = couponText[language];
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [type, setType] = useState<"MONTHLY_FREE_30D" | "LIFETIME_FREE">(
    "MONTHLY_FREE_30D",
  );
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [createdCode, setCreatedCode] = useState("");

  const loadCoupons = useCallback(async () => {
    const response = await fetch("/api/admin/coupons");
    const data = (await response.json().catch(() => ({}))) as {
      coupons?: CouponItem[];
      error?: string;
    };

    if (!response.ok || !data.coupons) {
      setError(data.error || t.failedLoad);
      return;
    }

    setCoupons(data.coupons);
  }, [t.failedLoad]);

  async function createCoupon(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    setCreatedCode("");

    const response = await fetch("/api/admin/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        code,
        note,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      coupon?: CouponItem;
      error?: string;
    };

    if (!response.ok || !data.coupon) {
      setError(data.error || t.failedCreate);
      setLoading(false);
      return;
    }

    setNotice(t.couponCreated);
    setCreatedCode(data.coupon.code);
    setCode("");
    setNote("");
    await loadCoupons();
    setLoading(false);
  }

  async function deactivateCoupon(id: string) {
    setError("");
    setNotice("");
    setCreatedCode("");

    const response = await fetch(`/api/admin/coupons/${id}/deactivate`, {
      method: "POST",
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };

    if (!response.ok) {
      setError(data.error || t.failedDeactivate);
      return;
    }

    setNotice(t.couponDeactivated);
    await loadCoupons();
  }

  async function deleteCoupon(id: string) {
    if (!window.confirm(t.deleteConfirm)) {
      return;
    }

    setError("");
    setNotice("");
    setCreatedCode("");

    const response = await fetch(`/api/admin/coupons/${id}`, {
      method: "DELETE",
    });

    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };

    if (!response.ok) {
      setError(data.error || t.failedDelete);
      return;
    }

    setNotice(t.couponDeleted);
    await loadCoupons();
  }

  async function copyCouponCode(targetCode: string) {
    try {
      await navigator.clipboard.writeText(targetCode);
      setNotice(t.copied);
      setError("");
    } catch {
      setError(t.failedCopy);
    }
  }

  useEffect(() => {
    void loadCoupons();
  }, [loadCoupons]);

  const locale = language === "ko" ? "ko-KR" : "en-US";

  function formatDateTime(value: string | null) {
    if (!value) {
      return t.noPeriod;
    }
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }

  function formatDate(value: string | null) {
    if (!value) {
      return t.noPeriod;
    }
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
    }).format(new Date(value));
  }

  function statusLabel(status: CouponItem["usageStatus"]) {
    if (status === "ACTIVE") {
      return t.statusActive;
    }
    if (status === "INACTIVE") {
      return t.statusInactive;
    }
    if (status === "IN_USE") {
      return t.statusInUse;
    }
    return t.statusUsed;
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          {t.title}
        </h1>
        <p className="mt-1 text-sm text-slate-600">{t.description}</p>
      </header>

      {notice ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <div className="flex flex-wrap items-center gap-2">
            <span>{notice}</span>
            {createdCode ? (
              <>
                <span className="font-mono font-semibold">{createdCode}</span>
                <button
                  type="button"
                  onClick={() => copyCouponCode(createdCode)}
                  className="rounded border border-emerald-300 bg-white px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  {t.copy}
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          {t.createSectionTitle}
        </h2>

        <form onSubmit={createCoupon} className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{t.type}</span>
            <select
              value={type}
              onChange={(event) =>
                setType(event.target.value as "MONTHLY_FREE_30D" | "LIFETIME_FREE")
              }
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700"
            >
              <option value="MONTHLY_FREE_30D">{t.monthlyType}</option>
              <option value="LIFETIME_FREE">{t.lifetimeType}</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">{t.customCode}</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700"
              placeholder={t.customCodePlaceholder}
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-slate-700">{t.note}</span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700"
              placeholder={t.notePlaceholder}
            />
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:w-auto"
            >
              {loading ? t.creating : t.createCoupon}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3 md:hidden">
        {coupons.map((coupon) => (
          <article
            key={coupon.id}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-semibold text-slate-950">
                  {coupon.code}
                </p>
                <p className="mt-1 text-xs text-slate-500">{coupon.type}</p>
              </div>
              <span
                className={`shrink-0 rounded px-2 py-1 text-xs font-semibold ${statusClass(coupon.usageStatus)}`}
              >
                {statusLabel(coupon.usageStatus)}
              </span>
            </div>
            <div className="mt-3 space-y-1 text-xs text-slate-600">
              <p>
                {t.created}: {formatDateTime(coupon.createdAt)}
              </p>
              <p>
                {t.redeemedBy}: {coupon.redeemedByUser?.email || t.searchEmpty}
              </p>
              <p>
                {t.startedAt}:{" "}
                {formatDate(coupon.appliedRedemption?.grantStartAt ?? null)}
              </p>
              <p>
                {t.endsAt}:{" "}
                {coupon.appliedRedemption?.grantIsLifetime
                  ? t.lifetime
                  : formatDate(coupon.appliedRedemption?.grantEndAt ?? null)}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => copyCouponCode(coupon.code)}
                className="min-h-10 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                {t.copy}
              </button>
              {!coupon.redeemedAt && coupon.isActive ? (
                <button
                  type="button"
                  onClick={() => deactivateCoupon(coupon.id)}
                  className="min-h-10 rounded-md border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                >
                  {t.deactivate}
                </button>
              ) : null}
              {!coupon.redeemedAt ? (
                <button
                  type="button"
                  onClick={() => deleteCoupon(coupon.id)}
                  className="min-h-10 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t.delete}
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </section>

      <section className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">{t.code}</th>
              <th className="px-3 py-3">{t.typeHeader}</th>
              <th className="px-3 py-3">{t.status}</th>
              <th className="px-3 py-3">{t.created}</th>
              <th className="px-3 py-3">{t.redeemedBy}</th>
              <th className="px-3 py-3">{t.startedAt}</th>
              <th className="px-3 py-3">{t.endsAt}</th>
              <th className="px-3 py-3">{t.action}</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((coupon) => (
              <tr key={coupon.id} className="border-t border-slate-100">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-900">{coupon.code}</span>
                    <button
                      type="button"
                      onClick={() => copyCouponCode(coupon.code)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      {t.copy}
                    </button>
                  </div>
                </td>
                <td className="px-3 py-3 text-slate-700">{coupon.type}</td>
                <td className="px-3 py-3">
                  <span
                    className={`rounded px-2 py-1 text-xs font-semibold ${statusClass(coupon.usageStatus)}`}
                  >
                    {statusLabel(coupon.usageStatus)}
                  </span>
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {formatDateTime(coupon.createdAt)}
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {coupon.redeemedByUser?.email || t.searchEmpty}
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {formatDate(coupon.appliedRedemption?.grantStartAt ?? null)}
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {coupon.appliedRedemption?.grantIsLifetime
                    ? t.lifetime
                    : formatDate(coupon.appliedRedemption?.grantEndAt ?? null)}
                </td>
                <td className="px-3 py-3">
                  {!coupon.redeemedAt ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {coupon.isActive ? (
                        <button
                          type="button"
                          onClick={() => deactivateCoupon(coupon.id)}
                          className="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                        >
                          {t.deactivate}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => deleteCoupon(coupon.id)}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {t.delete}
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">{t.searchEmpty}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
