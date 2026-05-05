"use client";

import Link from "next/link";
import { useLanguage } from "@/components/i18n/LanguageProvider";

const text = {
  en: {
    title: "Users",
    description: "Review account status, activity, conversations, and plan state.",
    search: "Search",
    searchPlaceholder: "email or name",
    searchButton: "Search",
    colUser: "User",
    colRole: "Role",
    colStatus: "Status",
    colCreated: "Created",
    colLastActivity: "Last activity",
    colPlan: "Plan",
    planNone: "none",
    planLifetime: "lifetime",
    planMonthly: "monthly until",
    planExpired: "expired",
  },
  ko: {
    title: "사용자",
    description: "계정 상태, 활동, 대화, 플랜을 검토합니다.",
    search: "검색",
    searchPlaceholder: "이메일 또는 이름",
    searchButton: "검색",
    colUser: "사용자",
    colRole: "역할",
    colStatus: "상태",
    colCreated: "가입일",
    colLastActivity: "마지막 활동",
    colPlan: "플랜",
    planNone: "없음",
    planLifetime: "평생 무료",
    planMonthly: "월 무료 만료:",
    planExpired: "만료됨",
  },
} as const;

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  createdAt: string;
  lastActiveAt: string;
  subscription: { isLifetime: boolean; planEndsAt: string | null } | null;
};

export function AdminUsersClient({
  users,
  q,
}: {
  users: UserRow[];
  q: string;
}) {
  const { language } = useLanguage();
  const t = text[language];
  const locale = language === "ko" ? "ko-KR" : "en-US";

  function planLabel(subscription: UserRow["subscription"]) {
    if (!subscription) return t.planNone;
    if (subscription.isLifetime) return t.planLifetime;
    if (subscription.planEndsAt) {
      return `${t.planMonthly} ${new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(subscription.planEndsAt))}`;
    }
    return t.planExpired;
  }

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{t.title}</h1>
        <p className="text-sm text-slate-600">{t.description}</p>
      </header>

      <form
        className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
        action="/admin/users"
        method="get"
      >
        <label className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="text-sm font-medium text-slate-700">{t.search}</span>
          <input
            type="text"
            name="q"
            defaultValue={q}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-700"
            placeholder={t.searchPlaceholder}
          />
          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 sm:w-auto"
          >
            {t.searchButton}
          </button>
        </label>
      </form>

      <section className="space-y-3 md:hidden">
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
            <div className="mt-3 grid gap-2 text-xs text-slate-600">
              <p>
                {t.colRole}: <span className="font-semibold">{user.role}</span>
              </p>
              <p>
                {t.colPlan}:{" "}
                <span className="font-semibold">
                  {planLabel(user.subscription)}
                </span>
              </p>
              <p>
                {t.colCreated}:{" "}
                {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                  new Date(user.createdAt),
                )}
              </p>
              <p>
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

      <section className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">{t.colUser}</th>
              <th className="px-3 py-3">{t.colRole}</th>
              <th className="px-3 py-3">{t.colStatus}</th>
              <th className="px-3 py-3">{t.colCreated}</th>
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
                </td>
                <td className="px-3 py-3 text-slate-700">{user.role}</td>
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
                <td className="px-3 py-3 text-slate-600">
                  {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                    new Date(user.createdAt),
                  )}
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
