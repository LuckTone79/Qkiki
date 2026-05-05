"use client";

import { useLanguage } from "@/components/i18n/LanguageProvider";

const text = {
  en: {
    title: "Audit logs",
    description: "Track admin actions and encrypted content access history.",
    adminActionLogs: "Admin action logs",
    contentAccessLogs: "Content access logs",
    colTime: "Time",
    colAdmin: "Admin",
    colAction: "Action",
    colTarget: "Target",
    colDetail: "Detail",
    colViewedUser: "Viewed user",
    colConversation: "Conversation",
    colReason: "Reason",
  },
  ko: {
    title: "감사 로그",
    description: "관리자 작업 및 암호화된 콘텐츠 접근 이력을 추적합니다.",
    adminActionLogs: "관리자 작업 로그",
    contentAccessLogs: "콘텐츠 접근 로그",
    colTime: "시간",
    colAdmin: "관리자",
    colAction: "액션",
    colTarget: "대상",
    colDetail: "상세",
    colViewedUser: "열람 대상 사용자",
    colConversation: "대화",
    colReason: "사유",
  },
} as const;

export type AuditLogItem = {
  id: string;
  createdAt: string;
  adminName: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detailJson: string | null;
};

export type ContentAccessLogItem = {
  id: string;
  createdAt: string;
  adminName: string;
  viewedUserName: string;
  conversationTitle: string | null;
  accessReasonCode: string;
};

export function AdminAuditLogsClient({
  auditLogs,
  contentAccessLogs,
}: {
  auditLogs: AuditLogItem[];
  contentAccessLogs: ContentAccessLogItem[];
}) {
  const { language } = useLanguage();
  const t = text[language];
  const locale = language === "ko" ? "ko-KR" : "en-US";

  function formatDetail(raw: string | null) {
    if (!raw) return "-";
    try {
      return JSON.stringify(JSON.parse(raw) as unknown);
    } catch {
      return raw;
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{t.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{t.description}</p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">{t.adminActionLogs}</h2>
        <div className="mt-3 space-y-2 md:hidden">
          {auditLogs.map((log) => (
            <article
              key={log.id}
              className="rounded-md border border-slate-200 bg-slate-50 p-3"
            >
              <p className="text-sm font-semibold text-slate-950">{log.action}</p>
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
                <p className="break-words">
                  {t.colDetail}: {formatDetail(log.detailJson)}
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
                <th className="px-2 py-2">{t.colDetail}</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
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
                  <td className="px-2 py-2 text-xs text-slate-600">
                    {formatDetail(log.detailJson)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">{t.contentAccessLogs}</h2>
        <div className="mt-3 space-y-2 md:hidden">
          {contentAccessLogs.map((log) => (
            <article
              key={log.id}
              className="rounded-md border border-slate-200 bg-slate-50 p-3"
            >
              <p className="text-sm font-semibold text-slate-950">
                {log.conversationTitle || "-"}
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
                  {t.colViewedUser}: {log.viewedUserName}
                </p>
                <p>
                  {t.colReason}: {log.accessReasonCode}
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
                <th className="px-2 py-2">{t.colViewedUser}</th>
                <th className="px-2 py-2">{t.colConversation}</th>
                <th className="px-2 py-2">{t.colReason}</th>
              </tr>
            </thead>
            <tbody>
              {contentAccessLogs.map((log) => (
                <tr key={log.id} className="border-t border-slate-100">
                  <td className="px-2 py-2 text-slate-600">
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(log.createdAt))}
                  </td>
                  <td className="px-2 py-2 text-slate-700">{log.adminName}</td>
                  <td className="px-2 py-2 text-slate-700">{log.viewedUserName}</td>
                  <td className="px-2 py-2 text-slate-700">{log.conversationTitle || "-"}</td>
                  <td className="px-2 py-2 text-slate-600">{log.accessReasonCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
