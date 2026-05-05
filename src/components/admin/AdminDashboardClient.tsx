"use client";

import { useLanguage } from "@/components/i18n/LanguageProvider";

const text = {
  en: {
    title: "Admin Dashboard",
    description: "User operations, monitoring, coupons, provider settings, and audit visibility.",
    totalUsers: "Total users",
    activeUsers: "Active users",
    conversations: "Conversations",
    todayQuestions: "Today questions",
    todayAiRequests: "Today AI requests",
    todayEstimatedCost: "Today estimated cost",
    todayAiErrors: "Today AI errors",
    todayCouponsUsed: "Today coupons used",
    couponsCreated: "Coupons created",
    couponsRedeemed: "Coupons redeemed",
    monthlyFreeUsers: "Monthly free users",
    lifetimeFreeUsers: "Lifetime free users",
    providerUsageToday: "Provider usage today",
    modelUsageToday: "Model usage today",
    topUsersByCost: "Top users by cost today",
    colName: "Name",
    colRequests: "Requests",
    colCost: "Cost",
    noAiRequests: "No AI requests today.",
    recentActivity: "Recent admin activity",
    colTime: "Time",
    colAdmin: "Admin",
    colAction: "Action",
    colTarget: "Target",
    noActivity: "No admin activity yet.",
  },
  ko: {
    title: "관리자 대시보드",
    description: "사용자 운영, 모니터링, 쿠폰, 공급자 설정 및 감사 가시성.",
    totalUsers: "총 사용자",
    activeUsers: "활성 사용자",
    conversations: "대화",
    todayQuestions: "오늘 질문 수",
    todayAiRequests: "오늘 AI 요청 수",
    todayEstimatedCost: "오늘 예상 비용",
    todayAiErrors: "오늘 AI 오류 수",
    todayCouponsUsed: "오늘 쿠폰 사용 수",
    couponsCreated: "발급된 쿠폰",
    couponsRedeemed: "사용된 쿠폰",
    monthlyFreeUsers: "월 무료 사용자",
    lifetimeFreeUsers: "평생 무료 사용자",
    providerUsageToday: "오늘 공급자별 사용량",
    modelUsageToday: "오늘 모델별 사용량",
    topUsersByPost: "오늘 비용 상위 사용자",
    topUsersByCost: "오늘 비용 상위 사용자",
    colName: "이름",
    colRequests: "요청",
    colCost: "비용",
    noAiRequests: "오늘 AI 요청이 없습니다.",
    recentActivity: "최근 관리자 활동",
    colTime: "시간",
    colAdmin: "관리자",
    colAction: "액션",
    colTarget: "대상",
    noActivity: "아직 관리자 활동이 없습니다.",
  },
} as const;

export type UsageRow = {
  label: string;
  requests: number;
  estimatedCost: number;
};

export type RecentAuditItem = {
  id: string;
  createdAt: string;
  adminName: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
};

export type DashboardMetrics = {
  totalUsers: number;
  activeUsers: number;
  conversations: number;
  todayQuestions: number;
  todayAiRequests: number;
  todayAiCostUsd: number;
  todayAiErrors: number;
  todayCouponRedemptions: number;
  coupons: number;
  redeemedCoupons: number;
  lifetimeUsers: number;
  monthlyUsers: number;
};

type AdminDashboardClientProps = {
  metrics: DashboardMetrics;
  providerUsage: UsageRow[];
  modelUsage: UsageRow[];
  topUserRows: UsageRow[];
  recentAudits: RecentAuditItem[];
};

function formatCost(value: number) {
  return `$${value.toFixed(5)}`;
}

export function AdminDashboardClient({
  metrics,
  providerUsage,
  modelUsage,
  topUserRows,
  recentAudits,
}: AdminDashboardClientProps) {
  const { language } = useLanguage();
  const t = text[language];
  const locale = language === "ko" ? "ko-KR" : "en-US";

  const metricCards = [
    { label: t.totalUsers, value: metrics.totalUsers },
    { label: t.activeUsers, value: metrics.activeUsers },
    { label: t.conversations, value: metrics.conversations },
    { label: t.todayQuestions, value: metrics.todayQuestions },
    { label: t.todayAiRequests, value: metrics.todayAiRequests },
    { label: t.todayEstimatedCost, value: formatCost(metrics.todayAiCostUsd) },
    { label: t.todayAiErrors, value: metrics.todayAiErrors },
    { label: t.todayCouponsUsed, value: metrics.todayCouponRedemptions },
    { label: t.couponsCreated, value: metrics.coupons },
    { label: t.couponsRedeemed, value: metrics.redeemedCoupons },
    { label: t.monthlyFreeUsers, value: metrics.monthlyUsers },
    { label: t.lifetimeFreeUsers, value: metrics.lifetimeUsers },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{t.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{t.description}</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => (
          <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{card.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <UsageTable title={t.providerUsageToday} rows={providerUsage} colName={t.colName} colRequests={t.colRequests} colCost={t.colCost} noData={t.noAiRequests} />
        <UsageTable title={t.modelUsageToday} rows={modelUsage} colName={t.colName} colRequests={t.colRequests} colCost={t.colCost} noData={t.noAiRequests} />
        <UsageTable title={t.topUsersByCost} rows={topUserRows} colName={t.colName} colRequests={t.colRequests} colCost={t.colCost} noData={t.noAiRequests} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">{t.recentActivity}</h2>
        {recentAudits.length ? (
          <>
          <div className="mt-3 space-y-2 md:hidden">
            {recentAudits.map((log) => (
              <article
                key={log.id}
                className="rounded-md border border-slate-200 bg-slate-50 p-3"
              >
                <p className="text-sm font-semibold text-slate-950">
                  {log.action}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(log.createdAt))}
                </p>
                <div className="mt-2 space-y-1 text-xs text-slate-600">
                  <p>
                    {t.colAdmin}: {log.adminName}
                  </p>
                  <p>
                    {t.colTarget}:{" "}
                    {log.targetType && log.targetId
                      ? `${log.targetType}:${log.targetId}`
                      : "-"}
                  </p>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-3 hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2">{t.colTime}</th>
                  <th className="px-2 py-2">{t.colAdmin}</th>
                  <th className="px-2 py-2">{t.colAction}</th>
                  <th className="px-2 py-2">{t.colTarget}</th>
                </tr>
              </thead>
              <tbody>
                {recentAudits.map((log) => (
                  <tr key={log.id} className="border-t border-slate-100">
                    <td className="px-2 py-2 text-slate-600">
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(log.createdAt))}
                    </td>
                    <td className="px-2 py-2 text-slate-700">{log.adminName}</td>
                    <td className="px-2 py-2 font-medium text-slate-900">{log.action}</td>
                    <td className="px-2 py-2 text-slate-600">
                      {log.targetType && log.targetId
                        ? `${log.targetType}:${log.targetId}`
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-600">{t.noActivity}</p>
        )}
      </section>
    </div>
  );
}

function UsageTable({
  title,
  rows,
  colName,
  colRequests,
  colCost,
  noData,
}: {
  title: string;
  rows: UsageRow[];
  colName: string;
  colRequests: string;
  colCost: string;
  noData: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      {rows.length ? (
        <>
        <div className="mt-3 space-y-2 md:hidden">
          {rows.map((row) => (
            <article
              key={row.label}
              className="rounded-md border border-slate-200 bg-slate-50 p-3"
            >
              <p className="truncate text-sm font-semibold text-slate-950">
                {row.label}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <p>
                  {colRequests}:{" "}
                  <span className="font-semibold text-slate-900">
                    {row.requests}
                  </span>
                </p>
                <p>
                  {colCost}:{" "}
                  <span className="font-semibold text-slate-900">
                    {formatCost(row.estimatedCost)}
                  </span>
                </p>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-3 hidden overflow-x-auto md:block">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-2">{colName}</th>
                <th className="px-2 py-2">{colRequests}</th>
                <th className="px-2 py-2">{colCost}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-t border-slate-100">
                  <td className="max-w-48 truncate px-2 py-2 font-medium text-slate-900">
                    {row.label}
                  </td>
                  <td className="px-2 py-2 text-slate-700">{row.requests}</td>
                  <td className="px-2 py-2 text-slate-700">{formatCost(row.estimatedCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-600">{noData}</p>
      )}
    </section>
  );
}
