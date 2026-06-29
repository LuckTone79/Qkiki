"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  adminTextKey,
  intlLocale,
  useLanguage,
} from "@/components/i18n/LanguageProvider";
import type { AdminUserListRow, UserSortOption } from "@/lib/admin-users";

const text = {
  en: {
    title: "Users",
    description:
      "Review account status, activity, usage, credits, and plan state at a glance.",
    search: "Search",
    searchPlaceholder: "email or name",
    searchButton: "Search",
    sortLabel: "Sort by",
    refresh: "Refresh",
    summaryUsers: "Users shown",
    summaryConversations: "Total tasks",
    summaryRequests: "Total model calls",
    summaryCredits: "Total credits used",
    summaryCost: "Total est. cost",
    colUser: "User",
    colRole: "Role",
    colStatus: "Status",
    colCreated: "Created",
    colLastActivity: "Last activity",
    colPlan: "Plan",
    colConversations: "Tasks",
    colRequests: "Calls",
    colCredits: "Credits",
    colTokens: "Tokens (in / out)",
    colCost: "Est. cost",
    planNone: "none",
    planLifetime: "lifetime",
    planMonthly: "monthly until",
    planExpired: "expired",
    sort: {
      recentActive: "Most recently active",
      recentJoined: "Most recently joined",
      mostConversations: "Most tasks",
      mostRequests: "Most model calls",
      mostCredits: "Most credits used",
      mostCost: "Highest estimated cost",
      mostTokens: "Most tokens used",
    },
  },
  ko: {
    title: "사용자",
    description:
      "계정 상태, 활동, 사용량, 크레딧, 플랜을 한눈에 검토합니다.",
    search: "검색",
    searchPlaceholder: "이메일 또는 이름",
    searchButton: "검색",
    sortLabel: "정렬",
    refresh: "새로고침",
    summaryUsers: "표시된 사용자",
    summaryConversations: "총 작업 수",
    summaryRequests: "총 모델 호출 수",
    summaryCredits: "총 크레딧 사용",
    summaryCost: "총 예상 비용",
    colUser: "사용자",
    colRole: "역할",
    colStatus: "상태",
    colCreated: "가입일",
    colLastActivity: "마지막 활동",
    colPlan: "플랜",
    colConversations: "작업",
    colRequests: "호출",
    colCredits: "크레딧",
    colTokens: "토큰 (입력 / 출력)",
    colCost: "예상 비용",
    planNone: "없음",
    planLifetime: "평생 무료",
    planMonthly: "월 무료 만료:",
    planExpired: "만료됨",
    sort: {
      recentActive: "최신 사용순",
      recentJoined: "최신 가입순",
      mostConversations: "최대 작업순",
      mostRequests: "최대 호출순",
      mostCredits: "최대 크레딧 사용순",
      mostCost: "최대 예상 비용순",
      mostTokens: "최대 토큰 사용순",
    },
  },
} as const;

export type UserRow = AdminUserListRow;

const SORT_ORDER: UserSortOption[] = [
  "recentActive",
  "recentJoined",
  "mostConversations",
  "mostRequests",
  "mostCredits",
  "mostCost",
  "mostTokens",
];

function formatCost(value: number) {
  return `$${value.toFixed(4)}`;
}

export function AdminUsersClient({
  users,
  q,
  sort,
}: {
  users: UserRow[];
  q: string;
  sort: UserSortOption;
}) {
  const { language } = useLanguage();
  const router = useRouter();
  const t = text[adminTextKey(language)];
  const locale = intlLocale(language);

  function planLabel(subscription: UserRow["subscription"]) {
    if (!subscription) return t.planNone;
    if (subscription.isLifetime) return t.planLifetime;
    if (subscription.planEndsAt) {
      return `${t.planMonthly} ${new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(subscription.planEndsAt))}`;
    }
    return t.planExpired;
  }

  function handleSortChange(nextSort: string) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("sort", nextSort);
    router.push(`/admin/users?${params.toString()}`);
  }

  const summary = users.reduce(
    (acc, user) => {
      acc.conversations += user.totalConversations;
      acc.requests += user.totalRequests;
      acc.credits += user.creditsUsed;
      acc.cost += user.estimatedCostUsd;
      return acc;
    },
    { conversations: 0, requests: 0, credits: 0, cost: 0 },
  );

  const summaryCards = [
    { label: t.summaryUsers, value: users.length.toLocaleString() },
    { label: t.summaryConversations, value: summary.conversations.toLocaleString() },
    { label: t.summaryRequests, value: summary.requests.toLocaleString() },
    { label: t.summaryCredits, value: summary.credits.toLocaleString() },
    { label: t.summaryCost, value: formatCost(summary.cost) },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{t.title}</h1>
          <p className="text-sm text-slate-600">{t.description}</p>
        </div>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {t.refresh}
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {card.label}
            </p>
            <p className="mt-1 text-xl font-semibold text-slate-950">{card.value}</p>
          </div>
        ))}
      </section>

      <form
        className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-end"
        action="/admin/users"
        method="get"
      >
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">{t.search}</span>
          <input
            type="text"
            name="q"
            defaultValue={q}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700"
            placeholder={t.searchPlaceholder}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">{t.sortLabel}</span>
          <select
            name="sort"
            value={sort}
            onChange={(event) => handleSortChange(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700 sm:w-56"
          >
            {SORT_ORDER.map((option) => (
              <option key={option} value={option}>
                {t.sort[option]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {t.searchButton}
        </button>
      </form>

      <section className="space-y-3 lg:hidden">
        {users.map((user) => (
          <article
            key={user.id}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/admin/users/${user.id}`}
                  className="font-semibold text-slate-900 hover:underline"
                >
                  {user.name || user.email}
                </Link>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
              </div>
              <span
                className={`shrink-0 rounded px-2 py-1 text-xs font-semibold ${
                  user.status === "ACTIVE"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-rose-50 text-rose-700"
                }`}
              >
                {user.status}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
              <p>
                {t.colConversations}:{" "}
                <span className="font-semibold text-slate-900">
                  {user.totalConversations.toLocaleString()}
                </span>
              </p>
              <p>
                {t.colRequests}:{" "}
                <span className="font-semibold text-slate-900">
                  {user.totalRequests.toLocaleString()}
                </span>
              </p>
              <p>
                {t.colCredits}:{" "}
                <span className="font-semibold text-slate-900">
                  {user.creditsUsed.toLocaleString()}
                </span>
              </p>
              <p>
                {t.colCost}:{" "}
                <span className="font-semibold text-slate-900">
                  {formatCost(user.estimatedCostUsd)}
                </span>
              </p>
              <p>
                {t.colTokens}:{" "}
                <span className="font-semibold text-slate-900">
                  {user.inputTokens.toLocaleString()} / {user.outputTokens.toLocaleString()}
                </span>
              </p>
              <p>
                {t.colPlan}:{" "}
                <span className="font-semibold">{planLabel(user.subscription)}</span>
              </p>
              <p className="col-span-2">
                {t.colLastActivity}:{" "}
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(user.lastActiveAt))}
              </p>
            </div>
          </article>
        ))}
      </section>

      <section className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm lg:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">{t.colUser}</th>
              <th className="px-3 py-3">{t.colStatus}</th>
              <th className="px-3 py-3 text-right">{t.colConversations}</th>
              <th className="px-3 py-3 text-right">{t.colRequests}</th>
              <th className="px-3 py-3 text-right">{t.colCredits}</th>
              <th className="px-3 py-3 text-right">{t.colTokens}</th>
              <th className="px-3 py-3 text-right">{t.colCost}</th>
              <th className="px-3 py-3">{t.colLastActivity}</th>
              <th className="px-3 py-3">{t.colPlan}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-3">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="font-semibold text-slate-900 hover:underline"
                  >
                    {user.name || user.email}
                  </Link>
                  <p className="text-xs text-slate-500">{user.email}</p>
                  <p className="text-[11px] text-slate-400">{user.role}</p>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`rounded px-2 py-1 text-xs font-semibold ${
                      user.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {user.status}
                  </span>
                </td>
                <td className="px-3 py-3 text-right font-medium text-slate-900">
                  {user.totalConversations.toLocaleString()}
                </td>
                <td className="px-3 py-3 text-right font-medium text-slate-900">
                  {user.totalRequests.toLocaleString()}
                </td>
                <td className="px-3 py-3 text-right font-medium text-slate-900">
                  {user.creditsUsed.toLocaleString()}
                </td>
                <td className="px-3 py-3 text-right text-slate-600">
                  {user.inputTokens.toLocaleString()} / {user.outputTokens.toLocaleString()}
                </td>
                <td className="px-3 py-3 text-right text-slate-700">
                  {formatCost(user.estimatedCostUsd)}
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(user.lastActiveAt))}
                </td>
                <td className="px-3 py-3 text-slate-700">{planLabel(user.subscription)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
