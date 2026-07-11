"use client";

import Link from "next/link";
import {
  adminTextKey,
  intlLocale,
  useLanguage,
} from "@/components/i18n/LanguageProvider";
import { AdminUserActions } from "@/components/admin/AdminUserActions";

const text = {
  en: {
    role: "Role",
    lastActivity: "Last activity",
    conversations: "Conversations",
    recentCoupons: "Recent coupon redemptions",
    usageLogs: "Recent usage logs",
    noConversations: "No conversations yet.",
    noCoupons: "No coupon redemptions.",
    noUsageLogs: "No usage logs yet.",
    subscription: "Subscription",
    usageSummary: "Usage summary",
    totalConversations: "Tasks",
    totalRequests: "Model calls",
    creditsUsed: "Credits used",
    totalTokens: "Tokens (in / out)",
    totalCost: "Estimated cost",
    creditWallet: "Credit wallet",
    paidCredits: "Paid",
    bonusCredits: "Bonus",
    walletUsed: "Used",
    colTask: "Task",
    colCalls: "Calls",
    colTokens: "Tokens (in / out)",
    colCost: "Cost",
    colTime: "Time",
    colType: "Type",
    colModel: "Model",
    colInput: "Input",
    colOutput: "Output",
  },
  ko: {
    role: "역할",
    lastActivity: "마지막 활동",
    conversations: "대화",
    recentCoupons: "최근 쿠폰 사용 내역",
    usageLogs: "최근 사용 로그",
    noConversations: "대화 내역이 없습니다.",
    noCoupons: "쿠폰 사용 내역이 없습니다.",
    noUsageLogs: "사용 로그가 없습니다.",
    subscription: "구독",
    usageSummary: "사용량 요약",
    totalConversations: "작업 수",
    totalRequests: "모델 호출 수",
    creditsUsed: "크레딧 사용",
    totalTokens: "토큰 (입력 / 출력)",
    totalCost: "예상 비용",
    creditWallet: "크레딧 지갑",
    paidCredits: "유료",
    bonusCredits: "보너스",
    walletUsed: "사용됨",
    colTask: "작업",
    colCalls: "호출",
    colTokens: "토큰 (입력 / 출력)",
    colCost: "비용",
    colTime: "시간",
    colType: "유형",
    colModel: "모델",
    colInput: "입력",
    colOutput: "출력",
  },
} as const;

export type UserDetailData = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: "ACTIVE" | "SUSPENDED";
  canManageAccount: boolean;
  createdAt: string;
  lastActiveAt: string;
  totals: {
    totalConversations: number;
    totalRequests: number;
    creditsUsed: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  };
  creditWallet: {
    paidCredits: number;
    bonusCredits: number;
    totalUsedCredits: number;
  } | null;
  sessions: Array<{
    id: string;
    title: string;
    mode: string;
    updatedAt: string;
    resultCount: number;
    requests: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  }>;
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

function formatCost(value: number) {
  return `$${value.toFixed(4)}`;
}

export function AdminUserDetailClient({ user }: { user: UserDetailData }) {
  const { language } = useLanguage();
  const t = text[adminTextKey(language)];
  const locale = intlLocale(language);

  const summaryCards = [
    { label: t.totalConversations, value: user.totals.totalConversations.toLocaleString() },
    { label: t.totalRequests, value: user.totals.totalRequests.toLocaleString() },
    { label: t.creditsUsed, value: user.totals.creditsUsed.toLocaleString() },
    {
      label: t.totalTokens,
      value: `${user.totals.inputTokens.toLocaleString()} / ${user.totals.outputTokens.toLocaleString()}`,
    },
    { label: t.totalCost, value: formatCost(user.totals.estimatedCostUsd) },
  ];

  return (
    <div className="space-y-5">
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{user.name || user.email}</h1>
        <p className="mt-1 text-sm text-slate-600">{user.email}</p>
        <p className="mt-2 text-xs text-slate-500">{t.role}: {user.role}</p>
        <p className="text-xs text-slate-500">
          {t.lastActivity}:{" "}
          {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
            new Date(user.lastActiveAt),
          )}
        </p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">{t.usageSummary}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {summaryCards.map((card) => (
            <div key={card.label} className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {card.label}
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-950">{card.value}</p>
            </div>
          ))}
        </div>
        {user.creditWallet ? (
          <p className="mt-3 text-xs text-slate-600">
            {t.creditWallet}: {t.paidCredits} {user.creditWallet.paidCredits.toLocaleString()} ·{" "}
            {t.bonusCredits} {user.creditWallet.bonusCredits.toLocaleString()} · {t.walletUsed}{" "}
            {user.creditWallet.totalUsedCredits.toLocaleString()}
          </p>
        ) : null}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">{t.conversations}</h2>
            {user.sessions.length ? (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="px-2 py-2">{t.colTask}</th>
                      <th className="px-2 py-2 text-right">{t.colCalls}</th>
                      <th className="px-2 py-2 text-right">{t.colTokens}</th>
                      <th className="px-2 py-2 text-right">{t.colCost}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.sessions.map((session) => (
                      <tr key={session.id} className="border-t border-slate-100">
                        <td className="px-2 py-2">
                          <Link
                            href={`/admin/conversations/${session.id}`}
                            className="font-semibold text-slate-900 hover:underline"
                          >
                            {session.title || "Untitled"}
                          </Link>
                        </td>
                        <td className="px-2 py-2 text-right text-slate-700">
                          {session.requests.toLocaleString()}
                        </td>
                        <td className="px-2 py-2 text-right text-slate-600">
                          {session.inputTokens.toLocaleString()} / {session.outputTokens.toLocaleString()}
                        </td>
                        <td className="px-2 py-2 text-right text-slate-700">
                          {formatCost(session.estimatedCostUsd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">{t.noConversations}</p>
            )}
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
                      <th className="px-2 py-2">{t.colTime}</th>
                      <th className="px-2 py-2">{t.colType}</th>
                      <th className="px-2 py-2">{t.colModel}</th>
                      <th className="px-2 py-2 text-right">{t.colInput}</th>
                      <th className="px-2 py-2 text-right">{t.colOutput}</th>
                      <th className="px-2 py-2 text-right">{t.colCost}</th>
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
                        <td className="px-2 py-2 text-right text-slate-700">{item.inputTokens.toLocaleString()}</td>
                        <td className="px-2 py-2 text-right text-slate-700">{item.outputTokens.toLocaleString()}</td>
                        <td className="px-2 py-2 text-right text-slate-700">{formatCost(item.estimatedCostUsd)}</td>
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
          {user.canManageAccount ? (
            <AdminUserActions userId={user.id} status={user.status} />
          ) : null}
        </div>
      </section>
    </div>
  );
}
