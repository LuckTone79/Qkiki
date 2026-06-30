"use client";

import { localize } from "@/lib/i18n";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { FeedbackBody } from "@/components/feedback/FeedbackBody";
import {
  categoryLabel,
  FEEDBACK_STATUS_VALUES,
  type FeedbackCategoryValue,
  type FeedbackStatusValue,
  formatFeedbackDate,
  statusBadgeClassName,
  statusLabel,
} from "@/components/feedback/labels";

type Comment = {
  id: string;
  body: string;
  isAdmin: boolean;
  authorName: string;
  createdAt: string;
};

export type AdminFeedbackDetailData = {
  id: string;
  title: string;
  body: string;
  category: FeedbackCategoryValue;
  status: FeedbackStatusValue;
  createdAt: string;
  user: { id: string; email: string; name: string | null };
  attachments: Array<{ id: string; name: string; url: string }>;
  comments: Comment[];
};

export function AdminFeedbackDetailClient({
  post,
}: {
  post: AdminFeedbackDetailData;
}) {
  const { language } = useLanguage();

  const [status, setStatus] = useState<FeedbackStatusValue>(post.status);
  const [savingStatus, setSavingStatus] = useState(false);
  const [comments, setComments] = useState<Comment[]>(post.comments);
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function changeStatus(next: FeedbackStatusValue) {
    setStatus(next);
    setSavingStatus(true);
    setNotice("");
    setError("");
    const response = await fetch(`/api/admin/feedback/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setSavingStatus(false);
    if (response.ok) {
      setNotice(localize(language, { en: "Status updated.", ko: "상태가 변경되었습니다.", ja: "\u30B9\u30C6\u30FC\u30BF\u30B9\u304C\u66F4\u65B0\u3055\u308C\u307E\u3057\u305F\u3002", es: "Estado actualizado." }));
    } else {
      setError(localize(language, { en: "Could not update status.", ko: "상태 변경에 실패했습니다.", ja: "\u30B9\u30C6\u30FC\u30BF\u30B9\u3092\u66F4\u65B0\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002", es: "No se pudo actualizar el estado." }));
    }
  }

  async function submitReply(event: FormEvent) {
    event.preventDefault();
    if (!reply.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/feedback/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        comment?: Comment;
        error?: string;
      };
      if (!response.ok || !data.comment) {
        setError(data.error || (localize(language, { en: "Could not send.", ko: "전송에 실패했습니다.", ja: "\u9001\u4FE1\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002", es: "No se pudo enviar." })));
        return;
      }
      setComments((current) => [...current, data.comment!]);
      setReply("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <Link
        href="/admin/feedback"
        className="text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        ← {localize(language, { en: "Back to feedback", ko: "피드백 목록", ja: "\u30D5\u30A3\u30FC\u30C9\u30D0\u30C3\u30AF\u306B\u623B\u308B", es: "Volver a comentarios" })}
      </Link>

      {notice ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-semibold tracking-tight text-slate-950">
              {post.title}
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              {categoryLabel(post.category, language)} ·{" "}
              {formatFeedbackDate(post.createdAt, language)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {post.user.name ? `${post.user.name} · ` : ""}
              {post.user.email}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClassName(status)}`}
            >
              {statusLabel(status, language)}
            </span>
            <select
              value={status}
              disabled={savingStatus}
              onChange={(event) =>
                changeStatus(event.target.value as FeedbackStatusValue)
              }
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-slate-500"
            >
              {FEEDBACK_STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {statusLabel(value, language)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 border-t border-slate-100 pt-4">
          <FeedbackBody body={post.body} />
        </div>

        {post.attachments.length ? (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {localize(language, { en: "Attachments", ko: "첨부 이미지", ja: "\u6DFB\u4ED8\u30D5\u30A1\u30A4\u30EB", es: "Adjuntos" })}
            </p>
            <div className="flex flex-wrap gap-2">
              {post.attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={attachment.url}
                    alt={attachment.name}
                    className="h-20 w-20 rounded-md border border-slate-200 object-cover"
                  />
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </article>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">
          {localize(language, { en: "Conversation", ko: "대화", ja: "\u4F1A\u8A71", es: "Conversaci\u00F3n" })}
        </h2>
        {comments.length === 0 ? (
          <p className="text-sm text-slate-500">
            {localize(language, { en: "No replies yet.", ko: "아직 답변이 없습니다.", ja: "\u307E\u3060\u8FD4\u4FE1\u306F\u3042\u308A\u307E\u305B\u3093\u3002", es: "A\u00FAn no hay respuestas." })}
          </p>
        ) : (
          <ul className="space-y-3">
            {comments.map((comment) => (
              <li
                key={comment.id}
                className={`rounded-lg border p-4 shadow-sm ${
                  comment.isAdmin
                    ? "border-teal-200 bg-teal-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    {comment.isAdmin
                      ? localize(language, { en: "Yapp team", ko: "운영팀", ja: "\u30E4\u30C3\u30D7\u30C1\u30FC\u30E0", es: "equipo yapp" })
                      : comment.authorName}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatFeedbackDate(comment.createdAt, language)}
                  </span>
                </div>
                <FeedbackBody body={comment.body} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <form
        onSubmit={submitReply}
        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      >
        <label className="block">
          <span className="text-sm font-medium text-slate-700">
            {localize(language, { en: "Reply to user", ko: "답변 작성", ja: "\u30E6\u30FC\u30B6\u30FC\u3078\u306E\u8FD4\u4FE1", es: "Responder al usuario" })}
          </span>
          <textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            rows={4}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
            placeholder={
              localize(language, { en: "Write a reply to the user.", ko: "사용자에게 전달할 답변을 입력하세요.", ja: "\u30E6\u30FC\u30B6\u30FC\u306B\u8FD4\u4FE1\u3092\u66F8\u304D\u307E\u3059\u3002", es: "Escribe una respuesta al usuario." })
            }
          />
        </label>
        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={submitting || !reply.trim()}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {submitting
              ? localize(language, { en: "Sending...", ko: "전송 중...", ja: "\u9001\u4FE1\u4E2D...", es: "Enviando..." })
              : localize(language, { en: "Send reply", ko: "답변 전송", ja: "\u8FD4\u4FE1\u3092\u9001\u4FE1", es: "Enviar respuesta" })}
          </button>
        </div>
      </form>
    </div>
  );
}
