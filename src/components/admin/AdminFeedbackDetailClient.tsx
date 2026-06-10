"use client";

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
  const ko = language === "ko";

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
      setNotice(ko ? "상태가 변경되었습니다." : "Status updated.");
    } else {
      setError(ko ? "상태 변경에 실패했습니다." : "Could not update status.");
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
        setError(data.error || (ko ? "전송에 실패했습니다." : "Could not send."));
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
        ← {ko ? "피드백 목록" : "Back to feedback"}
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
              {ko ? "첨부 이미지" : "Attachments"}
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
          {ko ? "대화" : "Conversation"}
        </h2>
        {comments.length === 0 ? (
          <p className="text-sm text-slate-500">
            {ko ? "아직 답변이 없습니다." : "No replies yet."}
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
                      ? ko
                        ? "운영팀"
                        : "Qkiki team"
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
            {ko ? "답변 작성" : "Reply to user"}
          </span>
          <textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            rows={4}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
            placeholder={
              ko ? "사용자에게 전달할 답변을 입력하세요." : "Write a reply to the user."
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
              ? ko
                ? "전송 중..."
                : "Sending..."
              : ko
                ? "답변 전송"
                : "Send reply"}
          </button>
        </div>
      </form>
    </div>
  );
}
