"use client";

import Link from "next/link";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { AdminUserActions } from "@/components/admin/AdminUserActions";

const text = {
  en: {
    role: "Role",
    conversations: "Conversations",
    recentCoupons: "Recent coupon redemptions",
    usageLogs: "Recent usage logs",
    noConversations: "No conversations yet.",
    noCoupons: "No coupon redemptions.",
    noUsageLogs: "No usage logs yet.",
    subscription: "Subscription",
  },
  ko: {
    role: "역할",
    conversations: "대화",
    recentCoupons: "최근 쿠폰 사용 내역",
    usageLogs: "최근 사용 로그",
    noConversations: "대화 내역이 없습니다.",
    noCoupons: "쿠폰 사용 내역이 없습니다.",
    noUsageLogs: "사용 로그가 없습니다.",
    subscription: "구독",
  },
} as const;

export type UserDetailData = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
  sessions: Array<{ id: string; title: string; mode: string; updatedAt: string; resultCount: number }>;
  couponRedemptions: Array<{
    id: string;
    couponCode: string;
    couponType: string;
    result: string;
    note: string | null;
    createdAt: string;
  }>;
  aiRequests: Array<{
    id: string;
    requestType: string;
    provider: string;
    model: string;
    status: string;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
    createdAt: string;
    conversationId: string | null;
    conversationTitle: string | null;
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
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{user.name || user.email}</h1>
        <p className="mt-1 text-sm text-slate-600">{user.email}</p>
        <p className="mt-2 text-xs text-slate-500">{t.role}: {user.role}</p>
      </header>

      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">{t.conversations}</h2>
            {user.sessions.length ? user.sessions.map((session) => (
              <div key={session.id} className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <Link href={`/admin/conversations/${session.id}`} className="font-semibold text-slate-900 hover:underline">
                  {session.title || "Untitled"}
                </Link>
              </div>
            )) : <p className="mt-3 text-sm text-slate-600">{t.noConversations}</p>}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">{t.recentCoupons}</h2>
            {user.couponRedemptions.length ? user.couponRedemptions.map((item) => (
              <p key={item.id} className="mt-2 text-sm text-slate-700">
                {item.couponCode} ({item.couponType}) - {item.result}
              </p>
            )) : <p className="mt-3 text-sm text-slate-600">{t.noCoupons}</p>}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">{t.usageLogs}</h2>
            {user.aiRequests.length ? (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="px-2 py-2">Time</th>
                      <th className="px-2 py-2">Type</th>
                      <th className="px-2 py-2">Model</th>
                      <th className="px-2 py-2">Input</th>
                      <th className="px-2 py-2">Output</th>
                      <th className="px-2 py-2">Cost($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.aiRequests.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-2 py-2 text-slate-600">
                          {new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}
                        </td>
                        <td className="px-2 py-2 text-slate-700">{item.requestType}</td>
                        <td className="px-2 py-2 text-slate-700">{item.provider}/{item.model}</td>
                        <td className="px-2 py-2 text-slate-700">{item.inputTokens.toLocaleString()}</td>
                        <td className="px-2 py-2 text-slate-700">{item.outputTokens.toLocaleString()}</td>
                        <td className="px-2 py-2 text-slate-700">{item.estimatedCostUsd.toFixed(6)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">{t.noUsageLogs}</p>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">{t.subscription}</h2>
            <p className="mt-2 text-sm text-slate-700">
              {user.subscription?.isLifetime ? "Lifetime" : user.subscription?.planEndsAt ? user.subscription.planEndsAt : "-"}
            </p>
          </section>
          <AdminUserActions userId={user.id} status={user.status} />
        </div>
      </section>
    </div>
  );
}
