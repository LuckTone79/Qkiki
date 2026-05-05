"use client";

import { useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";

const text = {
  en: {
    adminActions: "Admin actions",
    suspendUser: "Suspend user",
    unsuspendUser: "Unsuspend user",
    grantMonthly: "Grant monthly 30d",
    grantLifetime: "Grant lifetime",
    userSuspended: "User suspended.",
    userReactivated: "User reactivated.",
    alreadyLifetime: "User is already lifetime free. Event was logged.",
    grantedMonthly: "30-day free plan granted.",
    grantedLifetime: "Lifetime free granted.",
    failedStatus: "Failed to update status.",
    failedGrant: "Failed to grant subscription.",
  },
  ko: {
    adminActions: "관리자 작업",
    suspendUser: "사용자 정지",
    unsuspendUser: "정지 해제",
    grantMonthly: "30일 무료 부여",
    grantLifetime: "평생 무료 부여",
    userSuspended: "사용자를 정지했습니다.",
    userReactivated: "사용자 정지를 해제했습니다.",
    alreadyLifetime: "이미 평생 무료 사용자입니다. 이력이 기록되었습니다.",
    grantedMonthly: "30일 무료 플랜이 부여되었습니다.",
    grantedLifetime: "평생 무료가 부여되었습니다.",
    failedStatus: "상태 업데이트에 실패했습니다.",
    failedGrant: "이용권 부여에 실패했습니다.",
  },
} as const;

export function AdminUserActions({
  userId,
  status,
}: {
  userId: string;
  status: "ACTIVE" | "SUSPENDED";
}) {
  const { language } = useLanguage();
  const t = text[language];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function updateStatus(nextStatus: "ACTIVE" | "SUSPENDED") {
    setLoading(true);
    setError("");
    setNotice("");

    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(data.error || t.failedStatus);
      setLoading(false);
      return;
    }

    setNotice(nextStatus === "SUSPENDED" ? t.userSuspended : t.userReactivated);
    window.location.reload();
  }

  async function grant(type: "MONTHLY_FREE_30D" | "LIFETIME_FREE") {
    setLoading(true);
    setError("");
    setNotice("");

    const response = await fetch(`/api/admin/users/${userId}/grants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      result?: { result?: string };
    };

    if (!response.ok) {
      setError(data.error || t.failedGrant);
      setLoading(false);
      return;
    }

    if (data.result?.result === "already_lifetime") {
      setNotice(t.alreadyLifetime);
    } else {
      setNotice(type === "MONTHLY_FREE_30D" ? t.grantedMonthly : t.grantedLifetime);
    }

    window.location.reload();
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{t.adminActions}</h3>

      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        {status === "ACTIVE" ? (
          <button
            type="button"
            onClick={() => updateStatus("SUSPENDED")}
            disabled={loading}
            className="min-h-10 rounded-md border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
          >
            {t.suspendUser}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => updateStatus("ACTIVE")}
            disabled={loading}
            className="min-h-10 rounded-md border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            {t.unsuspendUser}
          </button>
        )}

        <button
          type="button"
          onClick={() => grant("MONTHLY_FREE_30D")}
          disabled={loading}
          className="min-h-10 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          {t.grantMonthly}
        </button>

        <button
          type="button"
          onClick={() => grant("LIFETIME_FREE")}
          disabled={loading}
          className="min-h-10 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {t.grantLifetime}
        </button>
      </div>

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
