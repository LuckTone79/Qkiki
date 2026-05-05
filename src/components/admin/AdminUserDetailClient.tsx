"use client";

import Link from "next/link";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { AdminUserActions } from "@/components/admin/AdminUserActions";

const text = {
  en: {
    role: "Role:",
    created: "Created",
    conversations: "Conversations",
    updated: "Updated",
    results: "results",
    noConversations: "No conversations yet.",
    recentCoupons: "Recent coupon redemptions",
    noCoupons: "No coupon redemptions.",
    subscription: "Subscription",
    lifetime: "Lifetime free",
    activeUntil: "Active until",
    noActivePlan: "No active free plan",
  },
  ko: {
    role: "역할:",
    created: "가입일",
    conversations: "대화",
    updated: "업데이트",
    results: "결과",
    noConversations: "아직 대화가 없습니다.",
    recentCoupons: "최근 쿠폰 사용 내역",
    noCoupons: "쿠폰 사용 내역이 없습니다.",
    subscription: "이용권",
    lifetime: "평생 무료",
    activeUntil: "활성 만료:",
    noActivePlan: "활성 플랜 없음",
  },
} as const;

export type UserDetailData = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
  sessions: Array<{
    id: string;
    title: string;
    mode: string;
    updatedAt: string;
    resultCount: number;
  }>;
  couponRedemptions: Array<{
    id: string;
    couponCode: string;
    couponType: string;
    result: string;
    note: string | null;
    createdAt: string;
  }>;
  subscription: { isLifetime: boolean; planEndsAt: string | null } | null;
};

export function AdminUserDetailClient({ user }: { user: UserDetailData }) {
  const { language } = useLanguage();
  const t = text[language];
  const locale = language === "ko" ? "ko-KR" : "en-US";

  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="break-words text-2xl font-semibold tracking-tight text-slate-950">
          {user.name || user.email}
        </h1>
        <p className="mt-1 text-sm text-slate-600">{user.email}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded bg-slate-100 px-2 py-1 font-semibold text-slate-700">
            {t.role} {user.role}
          </span>
          <span
            className={`rounded px-2 py-1 font-semibold ${
              user.status === "ACTIVE"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-rose-100 text-rose-700"
            }`}
          >
            {user.status}
          </span>
          <span className="rounded bg-slate-100 px-2 py-1 font-semibold text-slate-700">
            {t.created}{" "}
            {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
              new Date(user.createdAt),
            )}
          </span>
        </div>
      </header>

      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">{t.conversations}</h2>
            {user.sessions.length ? (
              <div className="mt-3 space-y-2">
                {user.sessions.map((session) => (
                  <div
                    key={session.id}
                    className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <Link
                        href={`/admin/conversations/${session.id}`}
                        className="font-semibold text-slate-900 hover:underline"
                      >
                        {session.title}
                      </Link>
                      <span className="text-xs text-slate-500">{session.mode}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {t.updated}{" "}
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(session.updatedAt))}{" "}
                      — {session.resultCount} {t.results}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">{t.noConversations}</p>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">{t.recentCoupons}</h2>
            {user.couponRedemptions.length ? (
              <div className="mt-3 space-y-2 text-sm">
                {user.couponRedemptions.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <p className="font-medium text-slate-900">
                      {item.couponCode} ({item.couponType}) — {item.result}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(item.createdAt))}
                      {item.note ? ` — ${item.note}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">{t.noCoupons}</p>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">{t.subscription}</h2>
            {user.subscription?.isLifetime ? (
              <p className="mt-2 text-sm text-slate-700">{t.lifetime}</p>
            ) : user.subscription?.planEndsAt ? (
              <p className="mt-2 text-sm text-slate-700">
                {t.activeUntil}{" "}
                {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                  new Date(user.subscription.planEndsAt),
                )}
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-700">{t.noActivePlan}</p>
            )}
          </section>

          <AdminUserActions userId={user.id} status={user.status} />
        </div>
      </section>
    </div>
  );
}
