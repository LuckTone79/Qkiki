"use client";

import { useLanguage } from "@/components/i18n/LanguageProvider";

const text = {
  en: {
    title: "Admin Dashboard",
    description: "Monitor usage, token costs, and conversion signals.",
    todayTotalRequests: "Today request actions",
    freeUserRequests: "Free requests",
    boostUserRequests: "Boost requests",
    paidUserRequests: "Paid requests",
    todayAiRequests: "Model calls",
    todayEstimatedCost: "Today estimated cost",
    todayAiErrors: "Today AI errors",
    limitReachedUsers: "Limit reached users",
    providerUsageToday: "Provider usage today",
    modelUsageToday: "Model usage today",
    topUsersByCost: "Top users by cost today",
    monthlyUsersByCost: "Monthly user token/cost usage",
    colName: "Name",
    colRequests: "Requests",
    colCost: "Cost",
    colInputTokens: "Input tokens",
    colOutputTokens: "Output tokens",
  },
  ko: {
    title: "관리자 대시보드",
    description: "사용량, 토큰 비용, 전환 지표를 모니터링합니다.",
    todayTotalRequests: "오늘 요청 액션 수",
    freeUserRequests: "무료 요청 수",
    boostUserRequests: "Boost 요청 수",
    paidUserRequests: "유료 요청 수",
    todayAiRequests: "모델 호출 수",
    todayEstimatedCost: "오늘 예상 비용",
    todayAiErrors: "오늘 AI 오류 수",
    limitReachedUsers: "한도 초과 사용자 수",
    providerUsageToday: "오늘 제공자 사용량",
    modelUsageToday: "오늘 모델 사용량",
    topUsersByCost: "오늘 비용 상위 사용자",
    monthlyUsersByCost: "월간 사용자 토큰/비용 사용량",
    colName: "사용자",
    colRequests: "요청",
    colCost: "비용",
    colInputTokens: "입력 토큰",
    colOutputTokens: "출력 토큰",
  },
} as const;

export type UsageRow = {
  label: string;
  requests: number;
  estimatedCost: number;
  inputTokens: number;
  outputTokens: number;
};

export type DashboardMetrics = {
  todayTotalRequests: number;
  freeUserRequests: number;
  boostUserRequests: number;
  paidUserRequests: number;
  todayAiRequests: number;
  todayEstimatedCost: number;
  todayAiErrors: number;
  limitReachedUsers: number;
};

type AdminDashboardClientProps = {
  metrics: DashboardMetrics;
  providerUsage: UsageRow[];
  modelUsage: UsageRow[];
  topUserRows: UsageRow[];
  monthlyUserCostRows: UsageRow[];
  recentAudits: unknown[];
};

function formatCost(value: number) {
  return `$${value.toFixed(5)}`;
}

export function AdminDashboardClient({
  metrics,
  providerUsage,
  modelUsage,
  topUserRows,
  monthlyUserCostRows,
}: AdminDashboardClientProps) {
  const { language } = useLanguage();
  const t = text[language];

  const metricCards = [
    { label: t.todayTotalRequests, value: metrics.todayTotalRequests },
    { label: t.freeUserRequests, value: metrics.freeUserRequests },
    { label: t.boostUserRequests, value: metrics.boostUserRequests },
    { label: t.paidUserRequests, value: metrics.paidUserRequests },
    { label: t.todayAiRequests, value: metrics.todayAiRequests },
    { label: t.todayEstimatedCost, value: formatCost(metrics.todayEstimatedCost) },
    { label: t.todayAiErrors, value: metrics.todayAiErrors },
    { label: t.limitReachedUsers, value: metrics.limitReachedUsers },
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
        <UsageTable title={t.providerUsageToday} rows={providerUsage} showTokens t={t} />
        <UsageTable title={t.modelUsageToday} rows={modelUsage} showTokens t={t} />
        <UsageTable title={t.topUsersByCost} rows={topUserRows} showTokens={false} t={t} />
      </section>

      <section>
        <UsageTable title={t.monthlyUsersByCost} rows={monthlyUserCostRows} showTokens t={t} />
      </section>
    </div>
  );
}

function UsageTable({
  title,
  rows,
  showTokens,
  t,
}: {
  title: string;
  rows: UsageRow[];
  showTokens: boolean;
  t: (typeof text)["en"] | (typeof text)["ko"];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2 py-2">{t.colName}</th>
              <th className="px-2 py-2">{t.colRequests}</th>
              {showTokens ? <th className="px-2 py-2">{t.colInputTokens}</th> : null}
              {showTokens ? <th className="px-2 py-2">{t.colOutputTokens}</th> : null}
              <th className="px-2 py-2">{t.colCost}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-slate-100">
                <td className="max-w-48 truncate px-2 py-2 font-medium text-slate-900">{row.label}</td>
                <td className="px-2 py-2 text-slate-700">{row.requests}</td>
                {showTokens ? <td className="px-2 py-2 text-slate-700">{row.inputTokens.toLocaleString()}</td> : null}
                {showTokens ? <td className="px-2 py-2 text-slate-700">{row.outputTokens.toLocaleString()}</td> : null}
                <td className="px-2 py-2 text-slate-700">{formatCost(row.estimatedCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
