"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { FeedbackBody } from "@/components/feedback/FeedbackBody";
import {
  categoryLabel,
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

export type FeedbackThreadData = {
  id: string;
  title: string;
  body: string;
  category: FeedbackCategoryValue;
  status: FeedbackStatusValue;
  createdAt: string;
  comments: Comment[];
};

export function FeedbackThreadClient({ post }: { post: FeedbackThreadData }) {
  const { language } = useLanguage();
  const router = useRouter();
  const ko = language === "ko";

  const [comments, setComments] = useState<Comment[]>(post.comments);
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function submitReply(event: FormEvent) {
    event.preventDefault();
    if (!reply.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/feedback/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        comment?: Comment;
        error?: string;
      };
      if (!response.ok || !data.comment) {
        setError(
          data.error || (ko ? "전송에 실패했습니다." : "Could not send."),
        );
        return;
      }
      setComments((current) => [...current, data.comment!]);
      setReply("");
    } finally {
      setSubmitting(false);
    }
  }

  async function deletePost() {
    if (
      !window.confirm(
        ko
          ? "이 글을 삭제할까요? 되돌릴 수 없습니다."
          : "Delete this post? This cannot be undone.",
      )
    ) {
      return;
    }
    setDeleting(true);
    const response = await fetch(`/api/feedback/${post.id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      router.push("/app/account/feedback");
    } else {
      setDeleting(false);
      setError(ko ? "삭제에 실패했습니다." : "Could not delete.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/app/account/feedback"
          className="text-sm font-medium text-stone-500 hover:text-stone-800"
        >
          ← {ko ? "목록으로" : "Back to list"}
        </Link>
        <button
          type="button"
          onClick={deletePost}
          disabled={deleting}
          className="text-sm font-medium text-rose-600 hover:text-rose-700 disabled:opacity-60"
        >
          {ko ? "삭제" : "Delete"}
        </button>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-semibold tracking-tight text-stone-950">
              {post.title}
            </h1>
            <p className="mt-1 text-xs text-stone-500">
              {categoryLabel(post.category, language)} ·{" "}
              {formatFeedbackDate(post.createdAt, language)}
            </p>
          </div>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClassName(post.status)}`}
          >
            {statusLabel(post.status, language)}
          </span>
        </div>
        <div className="mt-4 border-t border-stone-100 pt-4">
          <FeedbackBody body={post.body} />
        </div>
      </article>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-stone-700">
          {ko ? "대화" : "Conversation"}
        </h2>
        {comments.length === 0 ? (
          <p className="text-sm text-stone-500">
            {ko
              ? "아직 답변이 없습니다. 운영팀이 확인 후 답변드립니다."
              : "No replies yet. The team will respond after reviewing."}
          </p>
        ) : (
          <ul className="space-y-3">
            {comments.map((comment) => (
              <li
                key={comment.id}
                className={`rounded-lg border p-4 shadow-sm ${
                  comment.isAdmin
                    ? "border-teal-200 bg-teal-50"
                    : "border-stone-200 bg-white"
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-semibold text-stone-900">
                    {comment.isAdmin
                      ? ko
                        ? "운영팀"
                        : "Qkiki team"
                      : comment.authorName}
                  </span>
                  <span className="text-xs text-stone-500">
                    {formatFeedbackDate(comment.createdAt, language)}
                  </span>
                </div>
                <div className="text-sm leading-relaxed">
                  <FeedbackBody body={comment.body} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form
        onSubmit={submitReply}
        className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
      >
        <label className="block">
          <span className="text-sm font-medium text-stone-700">
            {ko ? "답변 추가" : "Add a message"}
          </span>
          <textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
            placeholder={
              ko ? "추가로 전달할 내용을 입력하세요." : "Write a follow-up message."
            }
          />
        </label>
        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={submitting || !reply.trim()}
            className="rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-60"
          >
            {submitting
              ? ko
                ? "전송 중..."
                : "Sending..."
              : ko
                ? "전송"
                : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
