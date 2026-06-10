"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SectionHeader } from "@/components/SectionHeader";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import {
  categoryLabel,
  FEEDBACK_CATEGORY_VALUES,
  type FeedbackCategoryValue,
  type FeedbackStatusValue,
  formatFeedbackDate,
  statusBadgeClassName,
  statusLabel,
} from "@/components/feedback/labels";

type FeedbackListItem = {
  id: string;
  title: string;
  category: FeedbackCategoryValue;
  status: FeedbackStatusValue;
  hasUnread: boolean;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
};

type UploadedAttachment = { id: string; name: string; url: string };

const MAX_PENDING = 10;

export function FeedbackBoardClient() {
  const { language } = useLanguage();
  const router = useRouter();
  const ko = language === "ko";
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [posts, setPosts] = useState<FeedbackListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<FeedbackCategoryValue>("BUG");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function loadPosts() {
    setLoading(true);
    const response = await fetch("/api/feedback");
    const data = (await response.json().catch(() => ({}))) as {
      posts?: FeedbackListItem[];
    };
    if (response.ok && data.posts) {
      setPosts(data.posts);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadPosts();
  }, []);

  function insertAtCursor(text: string) {
    const textarea = bodyRef.current;
    if (!textarea) {
      setBody((current) => `${current}${text}`);
      return;
    }
    const start = textarea.selectionStart ?? body.length;
    const end = textarea.selectionEnd ?? body.length;
    const next = `${body.slice(0, start)}${text}${body.slice(end)}`;
    setBody(next);
    requestAnimationFrame(() => {
      const cursor = start + text.length;
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  async function uploadImage(file: File) {
    if (attachments.length >= MAX_PENDING) {
      setError(
        ko
          ? `이미지는 최대 ${MAX_PENDING}개까지 첨부할 수 있습니다.`
          : `You can attach up to ${MAX_PENDING} images.`,
      );
      return null;
    }
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/feedback/attachments", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json().catch(() => ({}))) as {
        attachment?: UploadedAttachment;
        error?: string;
      };
      if (!response.ok || !data.attachment) {
        setError(
          data.error ||
            (ko ? "이미지 업로드에 실패했습니다." : "Image upload failed."),
        );
        return null;
      }
      setAttachments((current) => [...current, data.attachment!]);
      return data.attachment;
    } finally {
      setUploading(false);
    }
  }

  async function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const imageItems = Array.from(event.clipboardData.items).filter((item) =>
      item.type.startsWith("image/"),
    );
    if (!imageItems.length) {
      return;
    }
    event.preventDefault();
    for (const item of imageItems) {
      const file = item.getAsFile();
      if (!file) continue;
      const uploaded = await uploadImage(file);
      if (uploaded) {
        insertAtCursor(`\n![${uploaded.name}](${uploaded.url})\n`);
      }
    }
  }

  async function handleFilePick(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    for (const file of files) {
      const uploaded = await uploadImage(file);
      if (uploaded) {
        insertAtCursor(`\n![${uploaded.name}](${uploaded.url})\n`);
      }
    }
  }

  function resetForm() {
    setTitle("");
    setBody("");
    setCategory("BUG");
    setAttachments([]);
    setError("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!title.trim()) {
      setError(ko ? "제목을 입력하세요." : "Enter a title.");
      return;
    }
    if (!body.trim()) {
      setError(ko ? "내용을 입력하세요." : "Enter the details.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          category,
          attachmentIds: attachments.map((item) => item.id),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        post?: { id: string };
        error?: string;
      };
      if (!response.ok || !data.post) {
        setError(
          data.error ||
            (ko ? "등록에 실패했습니다." : "Could not submit feedback."),
        );
        return;
      }
      resetForm();
      setShowForm(false);
      router.push(`/app/account/feedback/${data.post.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow={ko ? "고객 지원" : "Support"}
        title={ko ? "피드백 게시판" : "Feedback board"}
        description={
          ko
            ? "불편 사항이나 제안을 남겨주세요. 작성한 글은 본인과 운영팀만 볼 수 있습니다."
            : "Report problems or suggest improvements. Only you and the Qkiki team can see your posts."
        }
      />

      <div className="flex items-center justify-between gap-3">
        <Link
          href="/app/account"
          className="text-sm font-medium text-stone-500 hover:text-stone-800"
        >
          ← {ko ? "계정으로" : "Back to account"}
        </Link>
        <button
          type="button"
          onClick={() => {
            setShowForm((value) => !value);
            setError("");
          }}
          className="rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
        >
          {showForm
            ? ko
              ? "닫기"
              : "Close"
            : ko
              ? "새 글 작성"
              : "New post"}
        </button>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {showForm ? (
        <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
              <label className="block">
                <span className="text-sm font-medium text-stone-700">
                  {ko ? "제목" : "Title"}
                </span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={200}
                  className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
                  placeholder={
                    ko ? "예: 결과 복사가 안돼요" : "e.g. Copy button not working"
                  }
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-stone-700">
                  {ko ? "분류" : "Category"}
                </span>
                <select
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value as FeedbackCategoryValue)
                  }
                  className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
                >
                  {FEEDBACK_CATEGORY_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {categoryLabel(value, language)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-stone-700">
                {ko ? "내용" : "Details"}
              </span>
              <textarea
                ref={bodyRef}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                onPaste={handlePaste}
                rows={10}
                className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-teal-600"
                placeholder={
                  ko
                    ? "무엇이 불편했는지 자세히 알려주세요. 캡처한 이미지를 이 영역에 바로 붙여넣을 수 있습니다 (Ctrl/⌘+V)."
                    : "Describe the issue. You can paste a screenshot directly here (Ctrl/⌘+V)."
                }
              />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60"
              >
                {uploading
                  ? ko
                    ? "업로드 중..."
                    : "Uploading..."
                  : ko
                    ? "🖼 이미지 첨부"
                    : "🖼 Attach image"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                onChange={handleFilePick}
                className="hidden"
              />
              <span className="text-xs text-stone-500">
                {ko
                  ? "PNG·JPEG·WebP·GIF, 최대 10MB"
                  : "PNG, JPEG, WebP, GIF · up to 10MB"}
              </span>
            </div>

            {attachments.length ? (
              <div className="flex flex-wrap gap-2">
                {attachments.map((item) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={item.id}
                    src={item.url}
                    alt={item.name}
                    className="h-16 w-16 rounded-md border border-stone-200 object-cover"
                  />
                ))}
              </div>
            ) : null}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {submitting
                  ? ko
                    ? "등록 중..."
                    : "Submitting..."
                  : ko
                    ? "등록하기"
                    : "Submit"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-lg border border-stone-200 bg-white shadow-sm">
        <header className="border-b border-stone-200 px-5 py-3">
          <h2 className="text-base font-semibold text-stone-950">
            {ko ? "내 피드백" : "My feedback"}
          </h2>
        </header>
        {loading ? (
          <p className="px-5 py-6 text-sm text-stone-500">
            {ko ? "불러오는 중..." : "Loading..."}
          </p>
        ) : posts.length === 0 ? (
          <p className="px-5 py-6 text-sm text-stone-500">
            {ko
              ? "아직 작성한 글이 없습니다."
              : "You have not posted any feedback yet."}
          </p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {posts.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/app/account/feedback/${post.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-stone-50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-stone-900">
                        {post.title}
                      </span>
                      {post.hasUnread ? (
                        <span className="inline-flex h-2 w-2 flex-none rounded-full bg-rose-500" title={ko ? "새 답변" : "New reply"} />
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-stone-500">
                      {categoryLabel(post.category, language)} ·{" "}
                      {formatFeedbackDate(post.createdAt, language)}
                      {post.commentCount > 0
                        ? ` · ${ko ? "답변" : "replies"} ${post.commentCount}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`flex-none rounded-full border px-2 py-0.5 text-xs font-semibold ${statusBadgeClassName(post.status)}`}
                  >
                    {statusLabel(post.status, language)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
