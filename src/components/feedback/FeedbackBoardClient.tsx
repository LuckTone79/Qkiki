"use client";

import { localize } from "@/lib/i18n";

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

  async function uploadImage(file: File) {
    if (attachments.length >= MAX_PENDING) {
      setError(
        localize(language, { en: `You can attach up to ${MAX_PENDING} images.`, ko: `이미지는 최대 ${MAX_PENDING}개까지 첨부할 수 있습니다.`, ja: `\u307E\u3067\u6DFB\u4ED8\u3067\u304D\u307E\u3059${MAX_PENDING}\u753B\u50CF\u3002`, es: `Puedes adjuntar hasta${MAX_PENDING}im\u00E1genes.` }),
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
            (localize(language, { en: "Image upload failed.", ko: "이미지 업로드에 실패했습니다.", ja: "\u753B\u50CF\u306E\u30A2\u30C3\u30D7\u30ED\u30FC\u30C9\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002", es: "Error al cargar la imagen." })),
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
      await uploadImage(file);
    }
  }

  async function handleFilePick(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    for (const file of files) {
      await uploadImage(file);
    }
  }

  async function removeAttachment(id: string) {
    setAttachments((current) => current.filter((item) => item.id !== id));
    await fetch(`/api/feedback/attachments/${id}`, { method: "DELETE" }).catch(
      () => {},
    );
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
      setError(localize(language, { en: "Enter a title.", ko: "제목을 입력하세요.", ja: "\u30BF\u30A4\u30C8\u30EB\u3092\u5165\u529B\u3057\u307E\u3059\u3002", es: "Introduzca un t\u00EDtulo." }));
      return;
    }
    if (!body.trim()) {
      setError(localize(language, { en: "Enter the details.", ko: "내용을 입력하세요.", ja: "\u8A73\u7D30\u3092\u5165\u529B\u3057\u307E\u3059\u3002", es: "Ingrese los detalles." }));
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
            (localize(language, { en: "Could not submit feedback.", ko: "등록에 실패했습니다.", ja: "\u30D5\u30A3\u30FC\u30C9\u30D0\u30C3\u30AF\u3092\u9001\u4FE1\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002", es: "No se pudo enviar comentarios." })),
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
        eyebrow={localize(language, { en: "Support", ko: "고객 지원", ja: "\u30B5\u30DD\u30FC\u30C8", es: "Apoyo" })}
        title={localize(language, { en: "Feedback board", ko: "피드백 게시판", ja: "\u30D5\u30A3\u30FC\u30C9\u30D0\u30C3\u30AF\u30DC\u30FC\u30C9", es: "Tablero de comentarios" })}
        description={
          localize(language, { en: "Report problems or suggest improvements. Only you and the Yapp team can see your posts.", ko: "불편 사항이나 제안을 남겨주세요. 작성한 글은 본인과 운영팀만 볼 수 있습니다.", ja: "\u554F\u984C\u3092\u5831\u544A\u3057\u305F\u308A\u3001\u6539\u5584\u3092\u63D0\u6848\u3057\u305F\u308A\u3067\u304D\u307E\u3059\u3002\u3042\u306A\u305F\u3068 Yapp \u30C1\u30FC\u30E0\u3060\u3051\u304C\u3042\u306A\u305F\u306E\u6295\u7A3F\u3092\u898B\u308B\u3053\u3068\u304C\u3067\u304D\u307E\u3059\u3002", es: "Informar problemas o sugerir mejoras. S\u00F3lo t\u00FA y el equipo de Yapp pod\u00E9is ver tus publicaciones." })
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/app/account"
          className="text-sm font-medium text-stone-500 hover:text-stone-800"
        >
          ← {localize(language, { en: "Back to account", ko: "계정으로", ja: "\u30A2\u30AB\u30A6\u30F3\u30C8\u306B\u623B\u308B", es: "Volver a la cuenta" })}
        </Link>
        <button
          type="button"
          onClick={() => {
            setShowForm((value) => !value);
            setError("");
          }}
          className="w-full rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800 sm:w-auto"
        >
          {showForm
            ? localize(language, { en: "Close", ko: "닫기", ja: "\u9589\u3058\u308B", es: "Cerrar" })
            : localize(language, { en: "New post", ko: "새 글 작성", ja: "\u65B0\u3057\u3044\u6295\u7A3F", es: "Nueva publicaci\u00F3n" })}
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
                  {localize(language, { en: "Title", ko: "제목", ja: "\u30BF\u30A4\u30C8\u30EB", es: "T\u00EDtulo" })}
                </span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={200}
                  className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
                  placeholder={
                    localize(language, { en: "e.g. Copy button not working", ko: "예: 결과 복사가 안돼요", ja: "\u4F8B\u3048\u3070\u30B3\u30D4\u30FC\u30DC\u30BF\u30F3\u304C\u6A5F\u80FD\u3057\u306A\u3044", es: "p.ej. El bot\u00F3n copiar no funciona" })
                  }
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-stone-700">
                  {localize(language, { en: "Category", ko: "분류", ja: "\u30AB\u30C6\u30B4\u30EA", es: "Categor\u00EDa" })}
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
                {localize(language, { en: "Details", ko: "내용", ja: "\u8A73\u7D30", es: "Detalles" })}
              </span>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                onPaste={handlePaste}
                rows={10}
                className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-teal-600"
                placeholder={
                  localize(language, { en: "Describe the issue. Paste a screenshot here (Ctrl/⌘+V) and it will be attached as a preview below.", ko: "무엇이 불편했는지 자세히 알려주세요. 캡처한 이미지를 이 영역에 바로 붙여넣으면(Ctrl/⌘+V) 아래에 미리보기로 첨부됩니다.", ja: "\u554F\u984C\u306B\u3064\u3044\u3066\u8AAC\u660E\u3057\u307E\u3059\u3002\u3053\u3053\u306B\u30B9\u30AF\u30EA\u30FC\u30F3\u30B7\u30E7\u30C3\u30C8\u3092\u8CBC\u308A\u4ED8\u3051\u308B\u3068 (Ctrl/\u2318+V)\u3001\u4E0B\u306B\u30D7\u30EC\u30D3\u30E5\u30FC\u3068\u3057\u3066\u6DFB\u4ED8\u3055\u308C\u307E\u3059\u3002", es: "Describe el problema. Pegue una captura de pantalla aqu\u00ED (Ctrl/\u2318+V) y se adjuntar\u00E1 como vista previa a continuaci\u00F3n." })
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
                  ? localize(language, { en: "Uploading...", ko: "업로드 중...", ja: "\u30A2\u30C3\u30D7\u30ED\u30FC\u30C9\u4E2D...", es: "Subiendo..." })
                  : localize(language, { en: "🖼 Attach image", ko: "🖼 이미지 첨부", ja: "\uD83D\uDDBC \u753B\u50CF\u3092\u6DFB\u4ED8", es: "\uD83D\uDDBC Adjuntar imagen" })}
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
                {localize(language, { en: "PNG, JPEG, WebP, GIF · up to 10MB", ko: "PNG·JPEG·WebP·GIF, 최대 10MB", ja: "PNG\u3001JPEG\u3001WebP\u3001GIF\u30FB\u6700\u592710MB", es: "PNG, JPEG, WebP, GIF \u00B7 hasta 10 MB" })}
              </span>
            </div>

            {attachments.length ? (
              <div>
                <p className="mb-2 text-xs font-medium text-stone-500">
                  {localize(language, { en: `${attachments.length} attached image${attachments.length > 1 ? "s" : ""}`, ko: `첨부 이미지 ${attachments.length}장`, ja: `${attachments.length}\u6DFB\u4ED8\u753B\u50CF${attachments.length > 1 ? "s" : ""}`, es: `${attachments.length}imagen adjunta${attachments.length > 1 ? "s" : ""}` })}
                </p>
                <div className="flex flex-wrap gap-3">
                  {attachments.map((item) => (
                    <div key={item.id} className="group relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.url}
                        alt={item.name}
                        className="h-24 w-24 rounded-md border border-stone-200 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeAttachment(item.id)}
                        aria-label={localize(language, { en: "Remove image", ko: "이미지 삭제", ja: "\u753B\u50CF\u3092\u524A\u9664", es: "Quitar imagen" })}
                        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-stone-300 bg-white text-sm font-semibold text-stone-600 shadow-sm hover:bg-rose-50 hover:text-rose-600"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex justify-stretch sm:justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 sm:w-auto"
              >
                {submitting
                  ? localize(language, { en: "Submitting...", ko: "등록 중...", ja: "\u9001\u4FE1\u4E2D...", es: "Enviando..." })
                  : localize(language, { en: "Submit", ko: "등록하기", ja: "\u63D0\u51FA\u3059\u308B", es: "Entregar" })}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-lg border border-stone-200 bg-white shadow-sm">
        <header className="border-b border-stone-200 px-5 py-3">
          <h2 className="text-base font-semibold text-stone-950">
            {localize(language, { en: "My feedback", ko: "내 피드백", ja: "\u79C1\u306E\u30D5\u30A3\u30FC\u30C9\u30D0\u30C3\u30AF", es: "Mis comentarios" })}
          </h2>
        </header>
        {loading ? (
          <p className="px-5 py-6 text-sm text-stone-500">
            {localize(language, { en: "Loading...", ko: "불러오는 중...", ja: "\u8AAD\u307F\u8FBC\u307F\u4E2D...", es: "Cargando..." })}
          </p>
        ) : posts.length === 0 ? (
          <p className="px-5 py-6 text-sm text-stone-500">
            {localize(language, { en: "You have not posted any feedback yet.", ko: "아직 작성한 글이 없습니다.", ja: "\u307E\u3060\u30D5\u30A3\u30FC\u30C9\u30D0\u30C3\u30AF\u3092\u6295\u7A3F\u3057\u3066\u3044\u307E\u305B\u3093\u3002", es: "A\u00FAn no has publicado ning\u00FAn comentario." })}
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
                        <span className="inline-flex h-2 w-2 flex-none rounded-full bg-rose-500" title={localize(language, { en: "New reply", ko: "새 답변", ja: "\u65B0\u3057\u3044\u8FD4\u4FE1", es: "Nueva respuesta" })} />
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-stone-500">
                      {categoryLabel(post.category, language)} ·{" "}
                      {formatFeedbackDate(post.createdAt, language)}
                      {post.commentCount > 0
                        ? ` · ${localize(language, { en: "replies", ko: "답변", ja: "\u8FD4\u4FE1\u3059\u308B", es: "respuestas" })} ${post.commentCount}`
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
