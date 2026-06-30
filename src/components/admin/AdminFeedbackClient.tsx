"use client";

import { localize } from "@/lib/i18n";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import {
  categoryLabel,
  FEEDBACK_STATUS_VALUES,
  type FeedbackCategoryValue,
  type FeedbackStatusValue,
  formatFeedbackDate,
  statusBadgeClassName,
  statusLabel,
} from "@/components/feedback/labels";

type AdminFeedbackItem = {
  id: string;
  title: string;
  category: FeedbackCategoryValue;
  status: FeedbackStatusValue;
  isUnread: boolean;
  commentCount: number;
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
  user: { id: string; email: string; name: string | null };
};

export function AdminFeedbackClient() {
  const { language } = useLanguage();
  const [posts, setPosts] = useState<AdminFeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | FeedbackStatusValue>("");

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (statusFilter) params.set("status", statusFilter);
    const response = await fetch(`/api/admin/feedback?${params.toString()}`);
    const data = (await response.json().catch(() => ({}))) as {
      posts?: AdminFeedbackItem[];
    };
    if (response.ok && data.posts) {
      setPosts(data.posts);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-slate-950">
          {localize(language, { en: "User feedback", ko: "사용자 피드백", ja: "\u30E6\u30FC\u30B6\u30FC\u304B\u3089\u306E\u30D5\u30A3\u30FC\u30C9\u30D0\u30C3\u30AF", es: "Comentarios de los usuarios" })}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {localize(language, { en: "Review and respond to all feedback submitted by users.", ko: "사용자들이 작성한 모든 피드백을 확인하고 응답할 수 있습니다.", ja: "\u30E6\u30FC\u30B6\u30FC\u304B\u3089\u9001\u4FE1\u3055\u308C\u305F\u3059\u3079\u3066\u306E\u30D5\u30A3\u30FC\u30C9\u30D0\u30C3\u30AF\u3092\u78BA\u8A8D\u3057\u3066\u8FD4\u4FE1\u3057\u307E\u3059\u3002", es: "Revisar y responder a todos los comentarios enviados por los usuarios." })}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            load();
          }}
          className="flex w-full flex-col gap-2 sm:flex-1 sm:flex-row sm:items-center"
        >
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={localize(language, { en: "Search title, body, email", ko: "제목·내용·이메일 검색", ja: "\u30BF\u30A4\u30C8\u30EB\u3001\u672C\u6587\u3001\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9\u3092\u691C\u7D22", es: "Buscar t\u00EDtulo, cuerpo, correo electr\u00F3nico" })}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 sm:max-w-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {loading ? (localize(language, { en: "Searching...", ko: "검색 중...", ja: "Searching...", es: "Searching..." })) : localize(language, { en: "Search", ko: "검색", ja: "\u691C\u7D22", es: "Buscar" })}
          </button>
        </form>
        <select
          value={statusFilter}
          disabled={loading}
          onChange={(event) =>
            setStatusFilter(event.target.value as "" | FeedbackStatusValue)
          }
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          <option value="">{localize(language, { en: "All statuses", ko: "전체 상태", ja: "\u3059\u3079\u3066\u306E\u30B9\u30C6\u30FC\u30BF\u30B9", es: "Todos los estados" })}</option>
          {FEEDBACK_STATUS_VALUES.map((value) => (
            <option key={value} value={value}>
              {statusLabel(value, language)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            {localize(language, { en: "Loading...", ko: "불러오는 중...", ja: "\u8AAD\u307F\u8FBC\u307F\u4E2D...", es: "Cargando..." })}
          </p>
        ) : posts.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            {localize(language, { en: "No feedback to display.", ko: "표시할 피드백이 없습니다.", ja: "\u8868\u793A\u3059\u308B\u30D5\u30A3\u30FC\u30C9\u30D0\u30C3\u30AF\u306F\u3042\u308A\u307E\u305B\u3093\u3002", es: "No hay comentarios para mostrar." })}
          </p>
        ) : (
          <>
            <div className="space-y-3 p-4 sm:hidden">
              {posts.map((post) => (
                <article key={post.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <Link
                    href={`/admin/feedback/${post.id}`}
                    className="flex items-start gap-2 font-medium text-slate-900 hover:text-teal-700"
                  >
                    {post.isUnread ? (
                      <span
                        className="mt-1 inline-flex h-2 w-2 flex-none rounded-full bg-rose-500"
                        title={localize(language, { en: "Unread", ko: "미확인", ja: "\u672A\u8AAD", es: "No le\u00EDdo" })}
                      />
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="block break-words">{post.title}</span>
                      <span className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-400">
                        {post.attachmentCount > 0 ? <span>첨부 {post.attachmentCount}</span> : null}
                        {post.commentCount > 0 ? <span>댓글 {post.commentCount}</span> : null}
                      </span>
                    </span>
                  </Link>
                  <div className="mt-3 space-y-1 text-xs text-slate-600">
                    <p className="break-all">{post.user.name || "익명"} / {post.user.email}</p>
                    <p>{categoryLabel(post.category, language)}</p>
                    <p>{formatFeedbackDate(post.createdAt, language)}</p>
                  </div>
                  <div className="mt-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusBadgeClassName(post.status)}`}
                    >
                      {statusLabel(post.status, language)}
                    </span>
                  </div>
                </article>
              ))}
            </div>

            <table className="hidden min-w-full divide-y divide-slate-200 text-sm sm:table">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">{localize(language, { en: "Title", ko: "제목", ja: "\u30BF\u30A4\u30C8\u30EB", es: "T\u00EDtulo" })}</th>
                  <th className="px-4 py-3">{localize(language, { en: "Author", ko: "작성자", ja: "\u8457\u8005", es: "Autor" })}</th>
                  <th className="px-4 py-3">{localize(language, { en: "Category", ko: "분류", ja: "\u30AB\u30C6\u30B4\u30EA", es: "Categor\u00EDa" })}</th>
                  <th className="px-4 py-3">{localize(language, { en: "Status", ko: "상태", ja: "\u72B6\u614B", es: "Estado" })}</th>
                  <th className="px-4 py-3">{localize(language, { en: "Created", ko: "작성일", ja: "\u4F5C\u6210\u3055\u308C\u307E\u3057\u305F", es: "Creado" })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {posts.map((post) => (
                  <tr key={post.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/feedback/${post.id}`}
                        className="flex items-center gap-2 font-medium text-slate-900 hover:text-teal-700"
                      >
                        {post.isUnread ? (
                          <span
                            className="inline-flex h-2 w-2 flex-none rounded-full bg-rose-500"
                            title={localize(language, { en: "Unread", ko: "미확인", ja: "\u672A\u8AAD", es: "No le\u00EDdo" })}
                          />
                        ) : null}
                        <span className="truncate">{post.title}</span>
                        {post.attachmentCount > 0 ? (
                          <span className="text-xs text-slate-400">첨부 {post.attachmentCount}</span>
                        ) : null}
                        {post.commentCount > 0 ? (
                          <span className="text-xs text-slate-400">댓글 {post.commentCount}</span>
                        ) : null}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="truncate">{post.user.name || "익명"}</div>
                      <div className="truncate text-xs text-slate-400">{post.user.email}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {categoryLabel(post.category, language)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusBadgeClassName(post.status)}`}
                      >
                        {statusLabel(post.status, language)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatFeedbackDate(post.createdAt, language)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
