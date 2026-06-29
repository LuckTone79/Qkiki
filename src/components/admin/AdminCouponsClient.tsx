"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  adminTextKey,
  intlLocale,
  localize,
  useLanguage,
} from "@/components/i18n/LanguageProvider";

type CouponTypeValue =
  | "MONTHLY_FREE_30D"
  | "MONTHLY_FREE_30D_DAILY_50"
  | "LIFETIME_FREE"
  | "LIFETIME_FREE_DAILY_50"
  | "WEEKLY_CREDIT"
  | "CREDIT_7D"
  | "CREDIT_30D"
  | "CREDIT_LIFETIME"
  | "UNLIMITED_7D"
  | "UNLIMITED_30D"
  | "UNLIMITED_LIFETIME";

type DurationValue = "7d" | "30d" | "lifetime";

type CouponItem = {
  id: string;
  code: string;
  type: CouponTypeValue;
  creditAmount: number | null;
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
    creditAmount: number | null;
    creditExpiresAt: string | null;
    createdAt: string;
  } | null;
};

const couponText = {
  en: {
    title: "Coupons",
    description:
      "Create credit coupons: a 7-day / 30-day / lifetime grant of a fixed credit amount, or unlimited credits for the period. You can create many at once.",
    createSectionTitle: "Create coupon",
    duration: "Duration",
    day7: "7 days",
    day30: "30 days",
    dayLifetime: "Lifetime",
    unlimited: "Unlimited credits",
    unlimitedHint: "No credit limit for the duration",
    quantity: "Quantity",
    quantityHint: "Create this many identical coupons at once",
    customCode: "Custom code (only when quantity is 1)",
    customCodePlaceholder: "auto-generate if empty",
    note: "Note",
    notePlaceholder: "internal memo",
    noteHeader: "Memo",
    creditAmount: "Credit amount",
    creditAmountPlaceholder: "credits granted",
    createCoupon: "Create coupon",
    creating: "Creating...",
    createdCodes: "Created codes",
    copyAll: "Copy all",
    searchEmpty: "-",
    code: "Code",
    copied: "Code copied.",
    copiedMany: "code(s) copied.",
    copy: "Copy",
    copySelected: "Copy selected",
    selectAll: "Select all",
    clearSelection: "Clear",
    noneSelected: "Select coupons to copy.",
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
    couponUpdated: "Coupon memo saved.",
    deactivate: "Deactivate",
    delete: "Delete",
    saveMemo: "Save memo",
    savingMemo: "Saving...",
    deleteConfirm: "Delete this coupon?",
    failedLoad: "Failed to load coupons.",
    failedCreate: "Failed to create coupon.",
    failedDeactivate: "Failed to deactivate coupon.",
    failedDelete: "Failed to delete coupon.",
    failedUpdate: "Failed to save coupon memo.",
    failedCopy: "Could not copy code.",
    noPeriod: "-",
    monthlyType: "monthly_free_30d (daily unlimited)",
    monthly50Type: "monthly_free_30d (daily 50)",
    lifetimeType: "lifetime_free (daily unlimited)",
    lifetime50Type: "lifetime_free (daily 50)",
    weeklyCreditType: "weekly credit coupon",
    credit7dType: "7-day credit",
    credit30dType: "30-day credit",
    creditLifetimeType: "lifetime credit",
    unlimited7dType: "7-day unlimited credits",
    unlimited30dType: "30-day unlimited credits",
    unlimitedLifetimeType: "lifetime unlimited credits",
    creditUnit: "credits",
  },
  ko: {
    title: "쿠폰",
    description:
      "크레딧 쿠폰을 발행합니다. 7일 / 30일 / 평생 동안 지정한 크레딧을 지급하거나, 기간 내 무제한 크레딧을 부여할 수 있습니다. 한 번에 여러 개도 생성할 수 있습니다.",
    createSectionTitle: "쿠폰 생성",
    duration: "기간",
    day7: "7일",
    day30: "30일",
    dayLifetime: "평생",
    unlimited: "무제한 크레딧",
    unlimitedHint: "기간 동안 크레딧 한도 없음",
    quantity: "수량",
    quantityHint: "동일한 쿠폰을 이 개수만큼 한 번에 생성",
    customCode: "직접 코드 (수량 1개일 때만)",
    customCodePlaceholder: "비워두면 자동 생성됩니다",
    note: "메모",
    notePlaceholder: "내부 메모",
    noteHeader: "메모",
    creditAmount: "크레딧 양",
    creditAmountPlaceholder: "지급할 크레딧",
    createCoupon: "쿠폰 생성",
    creating: "생성 중...",
    createdCodes: "생성된 코드",
    copyAll: "전체 복사",
    searchEmpty: "-",
    code: "코드",
    copied: "코드가 복사되었습니다.",
    copiedMany: "개 코드가 복사되었습니다.",
    copy: "복사",
    copySelected: "선택 복사",
    selectAll: "전체 선택",
    clearSelection: "해제",
    noneSelected: "복사할 쿠폰을 선택하세요.",
    typeHeader: "유형",
    status: "상태",
    created: "생성일",
    redeemedBy: "사용자",
    startedAt: "사용 시작일",
    endsAt: "종료일",
    action: "작업",
    statusActive: "활성",
    statusInactive: "비활성",
    statusInUse: "사용 중",
    statusUsed: "사용 종료",
    lifetime: "평생",
    couponCreated: "쿠폰 생성 완료",
    couponDeleted: "쿠폰을 삭제했습니다.",
    couponDeactivated: "쿠폰을 비활성화했습니다.",
    couponUpdated: "쿠폰 메모를 저장했습니다.",
    deactivate: "비활성화",
    delete: "삭제",
    saveMemo: "메모 저장",
    savingMemo: "저장 중...",
    deleteConfirm: "이 쿠폰을 삭제할까요?",
    failedLoad: "쿠폰을 불러오지 못했습니다.",
    failedCreate: "쿠폰 생성에 실패했습니다.",
    failedDeactivate: "쿠폰 비활성화에 실패했습니다.",
    failedDelete: "쿠폰 삭제에 실패했습니다.",
    failedUpdate: "쿠폰 메모 저장에 실패했습니다.",
    failedCopy: "코드 복사에 실패했습니다.",
    noPeriod: "-",
    monthlyType: "30일 무료 쿠폰 (일일 무제한)",
    monthly50Type: "30일 무료 쿠폰 (일일 50회)",
    lifetimeType: "평생 무료 쿠폰 (일일 무제한)",
    lifetime50Type: "평생 무료 쿠폰 (일일 50회)",
    weeklyCreditType: "7일 크레딧 쿠폰",
    credit7dType: "7일 크레딧",
    credit30dType: "30일 크레딧",
    creditLifetimeType: "평생 크레딧",
    unlimited7dType: "7일 무제한 크레딧",
    unlimited30dType: "30일 무제한 크레딧",
    unlimitedLifetimeType: "평생 무제한 크레딧",
    creditUnit: "크레딧",
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
  const t = couponText[adminTextKey(language)];
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [duration, setDuration] = useState<DurationValue>("7d");
  const [unlimited, setUnlimited] = useState(false);
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [creditAmount, setCreditAmount] = useState("500");
  const [quantity, setQuantity] = useState("1");
  const [loading, setLoading] = useState(false);
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [deletingCouponId, setDeletingCouponId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [createdCodes, setCreatedCodes] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [noteDraftById, setNoteDraftById] = useState<Record<string, string>>({});

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

    const nextCoupons = data.coupons;
    setCoupons(nextCoupons);
    setNoteDraftById((current) =>
      Object.fromEntries(
        nextCoupons.map((coupon) => [coupon.id, current[coupon.id] ?? coupon.note ?? ""]),
      ),
    );
  }, [t.failedLoad]);

  async function copyCodes(codes: string[]) {
    if (!codes.length) {
      setError(t.noneSelected);
      return;
    }

    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setError("");
      setNotice(
        codes.length === 1
          ? t.copied
          : `${codes.length}${language === "ko" ? "" : " "}${t.copiedMany}`,
      );
      if (codes.length === 1) {
        setCopiedCode(codes[0]);
        setTimeout(() => setCopiedCode(null), 1500);
      }
    } catch {
      setError(t.failedCopy);
    }
  }

  async function createCoupon(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    setCreatedCodes([]);

    const parsedQuantity = Math.max(1, Math.min(100, Number.parseInt(quantity, 10) || 1));

    const response = await fetch("/api/admin/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        duration,
        unlimited,
        quantity: parsedQuantity,
        code: parsedQuantity === 1 ? code : undefined,
        note,
        creditAmount: unlimited ? undefined : Number.parseInt(creditAmount, 10),
      }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      coupons?: { code: string }[];
      error?: string;
    };

    if (!response.ok || !data.coupons?.length) {
      setError(data.error || t.failedCreate);
      setLoading(false);
      return;
    }

    setNotice(t.couponCreated);
    setCreatedCodes(data.coupons.map((coupon) => coupon.code));
    setCode("");
    setNote("");
    await loadCoupons();
    setLoading(false);
  }

  async function deactivateCoupon(id: string) {
    if (deactivatingId) return;
    setDeactivatingId(id);
    setError("");
    setNotice("");

    try {
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
    } finally {
      setDeactivatingId(null);
    }
  }

  async function saveCouponNote(id: string) {
    const coupon = coupons.find((item) => item.id === id);
    if (!coupon) {
      return;
    }

    try {
      setSavingNoteId(id);
      setError("");
      setNotice("");

      const response = await fetch(`/api/admin/coupons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: noteDraftById[id] ?? coupon.note ?? "",
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        coupon?: { id: string; note: string | null };
        error?: string;
      };

      if (!response.ok || !data.coupon) {
        setError(data.error || t.failedUpdate);
        return;
      }

      setCoupons((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                note: data.coupon?.note ?? null,
              }
            : item,
        ),
      );
      setNoteDraftById((current) => ({
        ...current,
        [id]: data.coupon?.note ?? "",
      }));
      setNotice(t.couponUpdated);
    } catch {
      setError(t.failedUpdate);
    } finally {
      setSavingNoteId(null);
    }
  }

  async function deleteCoupon(id: string) {
    if (!window.confirm(t.deleteConfirm)) {
      return;
    }

    setDeletingCouponId(id);
    setError("");
    setNotice("");

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

    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setNotice(t.couponDeleted);
    setDeletingCouponId(null);
    await loadCoupons();
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const allSelected =
    coupons.length > 0 && coupons.every((coupon) => selectedIds.has(coupon.id));

  function toggleSelectAll() {
    setSelectedIds(
      allSelected ? new Set() : new Set(coupons.map((coupon) => coupon.id)),
    );
  }

  const selectedCodes = useMemo(
    () =>
      coupons
        .filter((coupon) => selectedIds.has(coupon.id))
        .map((coupon) => coupon.code),
    [coupons, selectedIds],
  );

  useEffect(() => {
    void loadCoupons();
  }, [loadCoupons]);

  const locale = intlLocale(language);

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

  function typeLabel(couponType: CouponTypeValue) {
    if (couponType === "MONTHLY_FREE_30D") return t.monthlyType;
    if (couponType === "MONTHLY_FREE_30D_DAILY_50") return t.monthly50Type;
    if (couponType === "LIFETIME_FREE") return t.lifetimeType;
    if (couponType === "LIFETIME_FREE_DAILY_50") return t.lifetime50Type;
    if (couponType === "CREDIT_7D") return t.credit7dType;
    if (couponType === "CREDIT_30D") return t.credit30dType;
    if (couponType === "CREDIT_LIFETIME") return t.creditLifetimeType;
    if (couponType === "UNLIMITED_7D") return t.unlimited7dType;
    if (couponType === "UNLIMITED_30D") return t.unlimited30dType;
    if (couponType === "UNLIMITED_LIFETIME") return t.unlimitedLifetimeType;
    return t.weeklyCreditType;
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
          <span>{notice}</span>
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
            <span className="text-sm font-medium text-slate-700">{t.duration}</span>
            <select
              value={duration}
              onChange={(event) => setDuration(event.target.value as DurationValue)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700"
            >
              <option value="7d">{t.day7}</option>
              <option value="30d">{t.day30}</option>
              <option value="lifetime">{t.dayLifetime}</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">{t.quantity}</span>
            <input
              type="number"
              min={1}
              max={100}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700"
            />
            <span className="mt-1 block text-xs text-slate-500">{t.quantityHint}</span>
          </label>

          <label className="flex items-start gap-2 md:col-span-2">
            <input
              type="checkbox"
              checked={unlimited}
              onChange={(event) => setUnlimited(event.target.checked)}
              className="mt-1 h-4 w-4 accent-slate-900"
            />
            <span>
              <span className="block text-sm font-medium text-slate-700">
                {t.unlimited}
              </span>
              <span className="text-xs text-slate-500">{t.unlimitedHint}</span>
            </span>
          </label>

          {!unlimited ? (
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                {t.creditAmount}
              </span>
              <input
                type="number"
                min={1}
                max={1000000}
                value={creditAmount}
                onChange={(event) => setCreditAmount(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700"
                placeholder={t.creditAmountPlaceholder}
              />
            </label>
          ) : null}

          {Number.parseInt(quantity, 10) === 1 ? (
            <label className="block">
              <span className="text-sm font-medium text-slate-700">{t.customCode}</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700"
                placeholder={t.customCodePlaceholder}
              />
            </label>
          ) : null}

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

        {createdCodes.length ? (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-emerald-900">
                {t.createdCodes} ({createdCodes.length})
              </p>
              <button
                type="button"
                onClick={() => copyCodes(createdCodes)}
                className="rounded border border-emerald-300 bg-white px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                {t.copyAll}
              </button>
            </div>
            <textarea
              readOnly
              value={createdCodes.join("\n")}
              rows={Math.min(8, createdCodes.length)}
              onFocus={(event) => event.currentTarget.select()}
              className="mt-2 w-full rounded-md border border-emerald-200 bg-white px-2 py-2 font-mono text-xs text-slate-800"
            />
          </div>
        ) : null}
      </section>

      {coupons.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            {allSelected ? t.clearSelection : t.selectAll}
          </button>
          <button
            type="button"
            onClick={() => copyCodes(selectedCodes)}
            disabled={!selectedCodes.length}
            className="rounded-md border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {t.copySelected} ({selectedCodes.length})
          </button>
        </div>
      ) : null}

      <section className="space-y-3 md:hidden">
        {coupons.map((coupon) => (
          <article
            key={coupon.id}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                <input
                  type="checkbox"
                  checked={selectedIds.has(coupon.id)}
                  onChange={() => toggleSelected(coupon.id)}
                  className="mt-1 h-4 w-4 shrink-0 accent-slate-900"
                />
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-semibold text-slate-950">
                    {coupon.code}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{typeLabel(coupon.type)}</p>
                  {coupon.creditAmount ? (
                    <p className="mt-1 text-xs font-medium text-slate-700">
                      {coupon.creditAmount.toLocaleString(locale)} {t.creditUnit}
                    </p>
                  ) : null}
                </div>
              </div>
              <span
                className={`shrink-0 rounded px-2 py-1 text-xs font-semibold ${statusClass(coupon.usageStatus)}`}
              >
                {statusLabel(coupon.usageStatus)}
              </span>
            </div>
            <div className="mt-3 space-y-1 text-xs text-slate-600">
              <div>
                <p className="font-medium text-slate-700">{t.noteHeader}</p>
                <textarea
                  value={noteDraftById[coupon.id] ?? coupon.note ?? ""}
                  onChange={(event) =>
                    setNoteDraftById((current) => ({
                      ...current,
                      [coupon.id]: event.target.value,
                    }))
                  }
                  rows={2}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-700 outline-none focus:border-slate-700"
                  placeholder={t.notePlaceholder}
                />
              </div>
              <p>
                {t.created}: {formatDateTime(coupon.createdAt)}
              </p>
              <p>
                {t.redeemedBy}: {coupon.redeemedByUser?.email || t.searchEmpty}
              </p>
              <p>
                {t.startedAt}: {formatDate(coupon.appliedRedemption?.grantStartAt ?? null)}
              </p>
              <p>
                {t.endsAt}:{" "}
                {coupon.appliedRedemption?.grantIsLifetime
                  ? t.lifetime
                  : formatDate(
                      coupon.appliedRedemption?.creditExpiresAt ??
                        coupon.appliedRedemption?.grantEndAt ??
                        null,
                    )}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => copyCodes([coupon.code])}
                className={`min-h-10 rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${copiedCode === coupon.code ? "border-teal-300 bg-teal-50 text-teal-700" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}
              >
                {copiedCode === coupon.code
                  ? localize(language, {
                      en: "Copied ✓",
                      ko: "복사됨 ✓",
                      ja: "コピーしました ✓",
                      es: "Copiado ✓",
                    })
                  : t.copy}
              </button>
              <button
                type="button"
                onClick={() => saveCouponNote(coupon.id)}
                disabled={savingNoteId === coupon.id}
                className="min-h-10 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                {savingNoteId === coupon.id ? t.savingMemo : t.saveMemo}
              </button>
              {coupon.isActive ? (
                <button
                  type="button"
                  onClick={() => deactivateCoupon(coupon.id)}
                  disabled={deactivatingId === coupon.id}
                  className="min-h-10 rounded-md border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deactivatingId === coupon.id
                    ? localize(language, {
                        en: "Deactivating…",
                        ko: "비활성화 중…",
                        ja: "無効化中…",
                        es: "Desactivando…",
                      })
                    : t.deactivate}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => deleteCoupon(coupon.id)}
                disabled={deletingCouponId === coupon.id}
                className="min-h-10 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingCouponId === coupon.id
                  ? localize(language, {
                      en: "Deleting…",
                      ko: "삭제 중…",
                      ja: "削除中…",
                      es: "Eliminando…",
                    })
                  : t.delete}
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 accent-slate-900"
                />
              </th>
              <th className="px-3 py-3">{t.code}</th>
              <th className="px-3 py-3">{t.typeHeader}</th>
              <th className="px-3 py-3">{t.status}</th>
              <th className="px-3 py-3">{t.created}</th>
              <th className="px-3 py-3">{t.noteHeader}</th>
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
                  <input
                    type="checkbox"
                    checked={selectedIds.has(coupon.id)}
                    onChange={() => toggleSelected(coupon.id)}
                    className="h-4 w-4 accent-slate-900"
                  />
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-900">{coupon.code}</span>
                    <button
                      type="button"
                      onClick={() => copyCodes([coupon.code])}
                      className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      {t.copy}
                    </button>
                  </div>
                </td>
                <td className="px-3 py-3 text-slate-700">
                  <div>{typeLabel(coupon.type)}</div>
                  {coupon.creditAmount ? (
                    <div className="mt-1 text-xs font-medium text-slate-500">
                      {coupon.creditAmount.toLocaleString(locale)} {t.creditUnit}
                    </div>
                  ) : null}
                </td>
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
                <td className="px-3 py-3">
                  <div className="min-w-[220px]">
                    <textarea
                      value={noteDraftById[coupon.id] ?? coupon.note ?? ""}
                      onChange={(event) =>
                        setNoteDraftById((current) => ({
                          ...current,
                          [coupon.id]: event.target.value,
                        }))
                      }
                      rows={2}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-700 outline-none focus:border-slate-700"
                      placeholder={t.notePlaceholder}
                    />
                    <button
                      type="button"
                      onClick={() => saveCouponNote(coupon.id)}
                      disabled={savingNoteId === coupon.id}
                      className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                    >
                      {savingNoteId === coupon.id ? t.savingMemo : t.saveMemo}
                    </button>
                  </div>
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
                    : formatDate(
                        coupon.appliedRedemption?.creditExpiresAt ??
                          coupon.appliedRedemption?.grantEndAt ??
                          null,
                      )}
                </td>
                <td className="px-3 py-3">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
