"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/i18n/LanguageProvider";

const text = {
  en: {
    title: "Users",
    description:
      "Filter accounts and review live task usage, credits, tokens, and activity at a glance.",
    search: "Search",
    searchPlaceholder: "email or name",
    sort: "Sort",
    status: "Status",
    role: "Role",
    allUsers: "Load all",
    apply: "Apply",
    visibleUsers: "Visible users",
    activeTasks: "Active tasks",
    totalCredits: "Credits used",
    totalTokens: "Tokens used",
    sortLatest: "Latest use",
    sortTasks: "Most tasks",
    sortCredits: "Most credits",
    sortTokens: "Most tokens",
    sortCreated: "Newest accounts",
    all: "All",
    colUser: "User",
    colActivity: "Activity",
    colUsage: "Usage totals",
    colRecentTasks: "Recent task usage",
    colPlan: "Plan",
    colStatus: "Status",
    created: "Created",
    latestUse: "Latest use",
    tasks: "Tasks",
    completed: "completed",
    running: "running",
    credits: "credits",
    input: "input",
    output: "output",
    cost: "cost",
    noRecentTasks: "No task usage yet",
    noUsers: "No users match these filters.",
    planNone: "none",
    planLifetime: "lifetime",
    planMonthly: "monthly until",
    planExpired: "expired",
  },
  ko: {
    title: "사용자",
    description:
      "계정을 필터링하고 작업 사용량, 크레딧, 토큰, 활동 상태를 한눈에 확인합니다.",
    search: "검색",
    searchPlaceholder: "이메일 또는 이름",
    sort: "정렬",
    status: "상태",
    role: "역할",
    allUsers: "전체 불러오기",
    apply: "적용",
    visibleUsers: "표시 사용자",
    activeTasks: "진행 중 작업",
    totalCredits: "사용 크레딧",
    totalTokens: "사용 토큰",
    sortLatest: "최신 사용순",
    sortTasks: "최대 작업순",
    sortCredits: "최대 크레딧 사용순",
    sortTokens: "최대 토큰 사용순",
    sortCreated: "최신 가입순",
    all: "전체",
    colUser: "사용자",
    colActivity: "활동",
    colUsage: "사용량 합계",
    colRecentTasks: "최근 작업 사용량",
    colPlan: "플랜",
    colStatus: "상태",
    created: "가입",
    latestUse: "최근 사용",
    tasks: "작업",
    completed: "완료",
    running: "진행 중",
    credits: "크레딧",
    input: "입력",
    output: "출력",
    cost: "비용",
    noRecentTasks: "아직 작업 사용량 없음",
    noUsers: "조건에 맞는 사용자가 없습니다.",
    planNone: "없음",
    planLifetime: "평생",
    planMonthly: "월간 만료:",
    planExpired: "만료됨",
  },
} as const;

type AdminUserSort = "latest" | "tasks" | "credits" | "tokens" | "created";
type AdminUserFilters = {
  q: string;
  sort: AdminUserSort;
  status: string;
  role: string;
  all: boolean;
};

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  planType: string;
  billingType: string;
  createdAt: string;
  lastActiveAt: string;
  subscription: { isLifetime: boolean; planEndsAt: string | null } | null;
  usage: {
    totalTaskCount: number;
    completedTaskCount: number;
    activeTaskCount: number;
    totalCreditsUsed: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalEstimatedCostUsd: number;
    lastUsageAt: string;
    recentTasks: Array<{
      id: string;
      requestType: string;
      status: string;
      models: string[];
      creditsUsed: number;
      inputTokens: number;
      outputTokens: number;
      estimatedCostUsd: number;
      createdAt: string;
    }>;
  };
};

function formatCost(value: number) {
  return `$${value.toFixed(value >= 1 ? 2 : 5)}`;
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function compactModels(models: string[]) {
  if (!models.length) {
    return "";
  }
  if (models.length <= 2) {
    return models.join(", ");
  }
  return `${models.slice(0, 2).join(", ")} +${models.length - 2}`;
}

export function AdminUsersClient({
  users,
  filters,
}: {
  users: UserRow[];
  filters: AdminUserFilters;
}) {
  const { language } = useLanguage();
  const t = text[language === "ko" ? "ko" : "en"];
  const locale = language === "ko" ? "ko-KR" : "en-US";

  const totals = users.reduce(
    (acc, user) => {
      acc.activeTasks += user.usage.activeTaskCount;
      acc.credits += user.usage.totalCreditsUsed;
      acc.tokens += user.usage.totalInputTokens + user.usage.totalOutputTokens;
      return acc;
    },
    { activeTasks: 0, credits: 0, tokens: 0 },
  );

  function planLabel(subscription: UserRow["subscription"]) {
    if (!subscription) return t.planNone;
    if (subscription.isLifetime) return t.planLifetime;
    if (subscription.planEndsAt) {
      return `${t.planMonthly} ${new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
      }).format(new Date(subscription.planEndsAt))}`;
    }
    return t.planExpired;
  }

  const metricCards = [
    { label: t.visibleUsers, value: users.length.toLocaleString(locale) },
    { label: t.activeTasks, value: totals.activeTasks.toLocaleString(locale) },
    { label: t.totalCredits, value: totals.credits.toLocaleString(locale) },
    { label: t.totalTokens, value: totals.tokens.toLocaleString(locale) },
  ];

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          {t.title}
        </h1>
        <p className="text-sm text-slate-600">{t.description}</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {card.value}
            </p>
          </div>
        ))}
      </section>

      <form
        className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:grid-cols-[minmax(180px,1.5fr)_repeat(3,minmax(140px,1fr))_auto_auto]"
        action="/admin/users"
        method="get"
      >
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t.search}
          </span>
          <input
            type="text"
            name="q"
            defaultValue={filters.q}
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-700"
            placeholder={t.searchPlaceholder}
          />
        </label>

        <SelectField label={t.sort} name="sort" defaultValue={filters.sort}>
          <option value="latest">{t.sortLatest}</option>
          <option value="tasks">{t.sortTasks}</option>
          <option value="credits">{t.sortCredits}</option>
          <option value="tokens">{t.sortTokens}</option>
          <option value="created">{t.sortCreated}</option>
        </SelectField>

        <SelectField label={t.status} name="status" defaultValue={filters.status}>
          <option value="all">{t.all}</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
        </SelectField>

        <SelectField label={t.role} name="role" defaultValue={filters.role}>
          <option value="all">{t.all}</option>
          <option value="USER">USER</option>
          <option value="SUPPORT_VIEWER">SUPPORT</option>
          <option value="ADMIN">ADMIN</option>
          <option value="SUPER_ADMIN">SUPER ADMIN</option>
        </SelectField>

        <label className="flex h-10 items-center gap-2 self-end rounded-md border border-slate-300 px-3 text-sm text-slate-700">
          <input
            type="checkbox"
            name="all"
            value="1"
            defaultChecked={filters.all}
            className="h-4 w-4 rounded border-slate-300"
          />
          {t.allUsers}
        </label>

        <button
          type="submit"
          className="h-10 self-end rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {t.apply}
        </button>
      </form>

      {users.length ? (
        <>
          <section className="space-y-3 md:hidden">
            {users.map((user) => (
              <article
                key={user.id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <UserHeading user={user} />
                  <StatusBadge status={user.status} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <MetricLine label={t.tasks} value={user.usage.totalTaskCount} />
                  <MetricLine label={t.credits} value={user.usage.totalCreditsUsed} />
                  <MetricLine
                    label="Tokens"
                    value={
                      user.usage.totalInputTokens + user.usage.totalOutputTokens
                    }
                  />
                  <MetricLine
                    label={t.running}
                    value={user.usage.activeTaskCount}
                  />
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  {t.latestUse}: {formatDate(user.lastActiveAt, locale)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {t.colPlan}: {planLabel(user.subscription)}
                </p>
                <RecentTasks user={user} locale={locale} t={t} />
              </article>
            ))}
          </section>

          <section className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm md:block">
            <table className="min-w-[1100px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">{t.colUser}</th>
                  <th className="px-3 py-3">{t.colActivity}</th>
                  <th className="px-3 py-3">{t.colUsage}</th>
                  <th className="px-3 py-3">{t.colRecentTasks}</th>
                  <th className="px-3 py-3">{t.colPlan}</th>
                  <th className="px-3 py-3">{t.colStatus}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-t border-slate-100 align-top hover:bg-slate-50"
                  >
                    <td className="px-3 py-3">
                      <UserHeading user={user} />
                      <p className="mt-2 text-xs text-slate-500">
                        {user.role} / {user.planType}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      <p>
                        {t.latestUse}:{" "}
                        <span className="font-medium text-slate-800">
                          {formatDate(user.lastActiveAt, locale)}
                        </span>
                      </p>
                      <p className="mt-1">
                        {t.created}: {formatDate(user.createdAt, locale)}
                      </p>
                      {user.usage.activeTaskCount ? (
                        <p className="mt-1 font-semibold text-amber-700">
                          {user.usage.activeTaskCount} {t.running}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      <p>
                        {t.tasks}:{" "}
                        <span className="font-semibold">
                          {user.usage.totalTaskCount.toLocaleString(locale)}
                        </span>{" "}
                        ({user.usage.completedTaskCount.toLocaleString(locale)}{" "}
                        {t.completed})
                      </p>
                      <p className="mt-1">
                        {t.credits}:{" "}
                        {user.usage.totalCreditsUsed.toLocaleString(locale)}
                      </p>
                      <p className="mt-1">
                        Tokens:{" "}
                        {(
                          user.usage.totalInputTokens +
                          user.usage.totalOutputTokens
                        ).toLocaleString(locale)}
                      </p>
                      <p className="mt-1">
                        {t.cost}: {formatCost(user.usage.totalEstimatedCostUsd)}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <RecentTasks user={user} locale={locale} t={t} compact />
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {planLabel(user.subscription)}
                      <p className="mt-1 text-xs text-slate-500">
                        {user.billingType}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={user.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : (
        <section className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-600 shadow-sm">
          {t.noUsers}
        </section>
      )}
    </div>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-700"
      >
        {children}
      </select>
    </label>
  );
}

function UserHeading({ user }: { user: UserRow }) {
  return (
    <div className="min-w-0">
      <Link
        href={`/admin/users/${user.id}`}
        className="block truncate font-semibold text-slate-900 hover:underline"
      >
        {user.name || user.email}
      </Link>
      <p className="truncate text-xs text-slate-500">{user.email}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${
        status === "ACTIVE"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-rose-50 text-rose-700"
      }`}
    >
      {status}
    </span>
  );
}

function MetricLine({ label, value }: { label: string; value: number }) {
  return (
    <p>
      {label}: <span className="font-semibold">{value.toLocaleString()}</span>
    </p>
  );
}

function RecentTasks({
  user,
  locale,
  t,
  compact = false,
}: {
  user: UserRow;
  locale: string;
  t: (typeof text)["en"] | (typeof text)["ko"];
  compact?: boolean;
}) {
  if (!user.usage.recentTasks.length) {
    return (
      <p className={compact ? "text-xs text-slate-500" : "mt-3 text-xs text-slate-500"}>
        {t.noRecentTasks}
      </p>
    );
  }

  return (
    <div className={compact ? "space-y-2" : "mt-3 space-y-2"}>
      {user.usage.recentTasks.map((task) => (
        <div
          key={task.id}
          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-slate-900">
              {task.requestType}
            </span>
            <span
              className={
                task.status === "completed"
                  ? "font-medium text-emerald-700"
                  : "font-medium text-amber-700"
              }
            >
              {task.status}
            </span>
            <span>{formatDate(task.createdAt, locale)}</span>
          </div>
          {task.models.length ? (
            <p className="mt-1 truncate text-slate-500">
              {compactModels(task.models)}
            </p>
          ) : null}
          <p className="mt-1">
            {task.creditsUsed.toLocaleString(locale)} {t.credits} /{" "}
            {task.inputTokens.toLocaleString(locale)} {t.input} /{" "}
            {task.outputTokens.toLocaleString(locale)} {t.output} /{" "}
            {formatCost(task.estimatedCostUsd)} {t.cost}
          </p>
        </div>
      ))}
    </div>
  );
}
