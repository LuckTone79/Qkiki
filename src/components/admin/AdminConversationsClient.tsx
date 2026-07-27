"use client";

import Link from "next/link";
import {
  adminTextKey,
  intlLocale,
  useLanguage,
} from "@/components/i18n/LanguageProvider";

type ConversationUser = {
  id: string;
  email: string;
  name: string | null;
  conversationCount: number;
};

type ConversationItem = {
  id: string;
  title: string;
  mode: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  counts: {
    workflowSteps: number;
    results: number;
  };
  usage: {
    totalCreditsUsed: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalEstimatedCostUsd: number;
  };
};

const conversationText = {
  en: {
    title: "Conversations",
    description: "Monitor user prompts and conversation execution flows.",
    userListTitle: "All users",
    allUsers: "All users",
    conversations: "conversations",
    selectedUser: "Selected user",
    search: "Search",
    searchPlaceholder: "title or user email",
    searchButton: "Search",
    updated: "Updated",
    steps: "steps",
    results: "results",
    credits: "credits",
    tokens: "tokens",
    cost: "cost",
    empty: "No conversations found.",
  },
  ko: {
    title: "\uB300\uD654",
    description:
      "\uC0AC\uC6A9\uC790 \uD504\uB86C\uD504\uD2B8\uC640 \uB300\uD654 \uC2E4\uD589 \uD750\uB984\uC744 \uBAA8\uB2C8\uD130\uB9C1\uD569\uB2C8\uB2E4.",
    userListTitle: "\uC804\uCCB4 \uAC00\uC785 \uC0AC\uC6A9\uC790",
    allUsers: "\uC804\uCCB4 \uC0AC\uC6A9\uC790",
    conversations: "\uAC1C \uB300\uD654",
    selectedUser: "\uC120\uD0DD \uC0AC\uC6A9\uC790",
    search: "\uAC80\uC0C9",
    searchPlaceholder: "\uB300\uD654 \uC81C\uBAA9 \uB610\uB294 \uC0AC\uC6A9\uC790 \uC774\uBA54\uC77C",
    searchButton: "\uAC80\uC0C9",
    updated: "\uCD5C\uC2E0 \uC5C5\uB370\uC774\uD2B8",
    steps: "\uB2E8\uACC4",
    results: "\uACB0\uACFC",
    credits: "\uD06C\uB808\uB527",
    tokens: "\uD1A0\uD070",
    cost: "\uAE08\uC561",
    empty: "\uB300\uD654 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.",
  },
} as const;

type AdminConversationsClientProps = {
  q: string;
  userId: string;
  users: ConversationUser[];
  conversations: ConversationItem[];
};

function buildHref(q: string, userId: string) {
  const params = new URLSearchParams();
  if (q) {
    params.set("q", q);
  }
  if (userId) {
    params.set("userId", userId);
  }
  const query = params.toString();
  return query ? `/admin/conversations?${query}` : "/admin/conversations";
}

function formatCost(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "$0.000000";
  }
  return `$${value.toFixed(6)}`;
}

export function AdminConversationsClient({
  q,
  userId,
  users,
  conversations,
}: AdminConversationsClientProps) {
  const { language } = useLanguage();
  const t = conversationText[adminTextKey(language)];
  const locale = intlLocale(language);
  const selectedUser =
    users.find((candidate) => candidate.id === userId) ?? null;

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          {t.title}
        </h1>
        <p className="text-sm text-slate-600">{t.description}</p>
      </header>

      <section className="grid min-w-0 gap-5 xl:grid-cols-[300px_1fr]">
        <aside className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">{t.userListTitle}</h2>
          <div className="mt-3 max-h-56 space-y-1 overflow-y-auto pr-1 lg:max-h-[65vh]">
            <Link
              href={buildHref(q, "")}
              className={`block rounded-md px-3 py-2 text-sm ${
                !userId
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{t.allUsers}</span>
              </div>
            </Link>
            {users.map((user) => (
              <Link
                key={user.id}
                href={buildHref(q, user.id)}
                className={`block rounded-md px-3 py-2 text-sm ${
                  userId === user.id
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{user.name || user.email}</span>
                  <span
                    className={`text-xs ${
                      userId === user.id ? "text-slate-200" : "text-slate-500"
                    }`}
                  >
                    {user.conversationCount}
                  </span>
                </div>
                <p
                  className={`truncate text-xs ${
                    userId === user.id ? "text-slate-200" : "text-slate-500"
                  }`}
                >
                  {user.email}
                </p>
              </Link>
            ))}
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          <form
            className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
            action="/admin/conversations"
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
              {userId ? <input type="hidden" name="userId" value={userId} /> : null}
              <button
                type="submit"
                className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 sm:w-auto"
              >
                {t.searchButton}
              </button>
            </label>
            {selectedUser ? (
              <p className="mt-2 text-xs text-slate-500">
                {t.selectedUser}: {selectedUser.name || selectedUser.email} (
                {selectedUser.email})
              </p>
            ) : null}
          </form>

          <section className="space-y-3">
            {conversations.length ? (
              conversations.map((conversation) => (
                <article
                  key={conversation.id}
                  className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,auto)] md:items-start">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/conversations/${conversation.id}`}
                        className="block text-base font-semibold leading-snug text-slate-900 [overflow-wrap:anywhere] hover:underline sm:text-lg"
                      >
                        {conversation.title}
                      </Link>
                      <p className="mt-1 break-all text-sm leading-relaxed text-slate-600">
                        {conversation.user.name || conversation.user.email} (
                        {conversation.user.email})
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {t.updated}{" "}
                        {new Intl.DateTimeFormat(locale, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(conversation.updatedAt))}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 rounded-md bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-3 md:min-w-[220px] md:text-right">
                      <p className="font-medium text-slate-700">{conversation.mode}</p>
                      <p>
                        {conversation.counts.workflowSteps.toLocaleString(locale)} {t.steps}
                      </p>
                      <p>
                        {conversation.counts.results.toLocaleString(locale)} {t.results}
                      </p>
                      <p>
                        {conversation.usage.totalCreditsUsed.toLocaleString(locale)} {t.credits}
                      </p>
                      <p>
                        {(
                          conversation.usage.totalInputTokens +
                          conversation.usage.totalOutputTokens
                        ).toLocaleString(locale)}{" "}
                        {t.tokens}
                      </p>
                      <p>
                        {formatCost(conversation.usage.totalEstimatedCostUsd)} {t.cost}
                      </p>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <p className="rounded-lg border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600 shadow-sm">
                {t.empty}
              </p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
