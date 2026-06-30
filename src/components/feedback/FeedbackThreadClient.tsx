"use client";

import { localize } from "@/lib/i18n";

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
  attachments: Array<{ id: string; name: string; url: string }>;
  comments: Comment[];
};

export function FeedbackThreadClient({ post }: { post: FeedbackThreadData }) {
  const { language } = useLanguage();
  const router = useRouter();

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
          data.error || (localize(language, { en: "Could not send.", ko: "전송에 실패했습니다.", ja: "\u9001\u4FE1\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002", es: "No se pudo enviar." })),
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
        localize(language, { en: "Delete this post? This cannot be undone.", ko: "이 글을 삭제할까요? 되돌릴 수 없습니다.", ja: "\u3053\u306E\u6295\u7A3F\u3092\u524A\u9664\u3057\u307E\u3059\u304B?\u3053\u308C\u3092\u5143\u306B\u623B\u3059\u3053\u3068\u306F\u3067\u304D\u307E\u305B\u3093\u3002", es: "\u00BFEliminar esta publicaci\u00F3n? Esto no se puede deshacer." }),
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
      setError(localize(language, { en: "Could not delete.", ko: "삭제에 실패했습니다.", ja: "\u524A\u9664\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002", es: "No se pudo eliminar." }));
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/app/account/feedback"
          className="text-sm font-medium text-stone-500 hover:text-stone-800"
        >
          ← {localize(language, { en: "Back to list", ko: "목록으로", ja: "\u30EA\u30B9\u30C8\u306B\u623B\u308B", es: "volver a la lista" })}
        </Link>
        <button
          type="button"
          onClick={deletePost}
          disabled={deleting}
          className="w-full text-left text-sm font-medium text-rose-600 hover:text-rose-700 disabled:opacity-60 sm:w-auto sm:text-right"
        >
          {localize(language, { en: "Delete", ko: "삭제", ja: "\u6D88\u53BB", es: "Borrar" })}
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

        {post.attachments.length ? (
          <div className="mt-4 border-t border-stone-100 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
              {localize(language, { en: "Attachments", ko: "첨부 이미지", ja: "\u6DFB\u4ED8\u30D5\u30A1\u30A4\u30EB", es: "Adjuntos" })}
            </p>
            <div className="flex flex-wrap gap-3">
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
                    className="max-h-72 max-w-full rounded-md border border-stone-200"
                  />
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </article>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-stone-700">
          {localize(language, { en: "Conversation", ko: "대화", ja: "\u4F1A\u8A71", es: "Conversaci\u00F3n" })}
        </h2>
        {comments.length === 0 ? (
          <p className="text-sm text-stone-500">
            {localize(language, { en: "No replies yet. The team will respond after reviewing.", ko: "아직 답변이 없습니다. 운영팀이 확인 후 답변드립니다.", ja: "\u307E\u3060\u8FD4\u4FE1\u306F\u3042\u308A\u307E\u305B\u3093\u3002\u30C1\u30FC\u30E0\u306F\u691C\u8A0E\u5F8C\u306B\u5BFE\u5FDC\u3055\u305B\u3066\u3044\u305F\u3060\u304D\u307E\u3059\u3002", es: "A\u00FAn no hay respuestas. El equipo responder\u00E1 despu\u00E9s de revisar." })}
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
                      ? localize(language, { en: "Yapp team", ko: "운영팀", ja: "\u30E4\u30C3\u30D7\u30C1\u30FC\u30E0", es: "equipo yapp" })
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
            {localize(language, { en: "Add a message", ko: "답변 추가", ja: "\u30E1\u30C3\u30BB\u30FC\u30B8\u3092\u8FFD\u52A0\u3059\u308B", es: "A\u00F1adir un mensaje" })}
          </span>
          <textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
            placeholder={
              localize(language, { en: "Write a follow-up message.", ko: "추가로 전달할 내용을 입력하세요.", ja: "\u30D5\u30A9\u30ED\u30FC\u30A2\u30C3\u30D7\u30E1\u30C3\u30BB\u30FC\u30B8\u3092\u66F8\u304D\u307E\u3059\u3002", es: "Escribe un mensaje de seguimiento." })
            }
          />
        </label>
        <div className="mt-3 flex justify-stretch sm:justify-end">
          <button
            type="submit"
            disabled={submitting || !reply.trim()}
            className="w-full rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-60 sm:w-auto"
          >
            {submitting
              ? localize(language, { en: "Sending...", ko: "전송 중...", ja: "\u9001\u4FE1\u4E2D...", es: "Enviando..." })
              : localize(language, { en: "Send", ko: "전송", ja: "\u9001\u4FE1", es: "Enviar" })}
          </button>
        </div>
      </form>
    </div>
  );
}
