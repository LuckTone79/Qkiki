"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SectionHeader } from "@/components/SectionHeader";
import { localize, useLanguage } from "@/components/i18n/LanguageProvider";
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
  const tt = (variants: Record<"en" | "ko" | "ja" | "es", string>) =>
    localize(language, variants);
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
        tt({
          en: `You can attach up to ${MAX_PENDING} images.`,
          ko: `이미지는 최대 ${MAX_PENDING}개까지 첨부할 수 있습니다.`,
          ja: `画像は最大 ${MAX_PENDING} 個まで添付できます。`,
          es: `Puedes adjuntar hasta ${MAX_PENDING} imágenes.`,
        }),
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
            tt({
              en: "Image upload failed.",
              ko: "이미지 업로드에 실패했습니다.",
              ja: "画像のアップロードに失敗しました。",
              es: "La carga de la imagen falló.",
            }),
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
      setError(
        tt({
          en: "Enter a title.",
          ko: "제목을 입력하세요.",
          ja: "タイトルを入力してください。",
          es: "Ingresa un título.",
        }),
      );
      return;
    }
    if (!body.trim()) {
      setError(
        tt({
          en: "Enter the details.",
          ko: "내용을 입력하세요.",
          ja: "内容を入力してください。",
          es: "Ingresa los detalles.",
        }),
      );
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
            tt({
              en: "Could not submit feedback.",
              ko: "등록에 실패했습니다.",
              ja: "送信できませんでした。",
              es: "No se pudo enviar el comentario.",
            }),
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
        eyebrow={tt({
          en: "Support",
          ko: "고객 지원",
          ja: "サポート",
          es: "Soporte",
        })}
        title={tt({
          en: "Feedback board",
          ko: "피드백 게시판",
          ja: "フィードバックボード",
          es: "Tablero de comentarios",
        })}
        description={tt({
          en: "Report problems or suggest improvements. Only you and the Yapp team can see your posts.",
          ko: "불편 사항이나 제안을 남겨주세요. 작성한 글은 본인과 운영팀만 볼 수 있습니다.",
          ja: "問題の報告や改善の提案をお寄せください。投稿はご本人と運営チームのみが閲覧できます。",
          es: "Informa problemas o sugiere mejoras. Solo tú y el equipo de Yapp pueden ver tus publicaciones.",
        })}
      />

      <div className="flex items-center justify-between gap-3">
        <Link
          href="/app/account"
          className="text-sm font-medium text-stone-500 hover:text-stone-800"
        >
          ←{" "}
          {tt({
            en: "Back to account",
            ko: "계정으로",
            ja: "アカウントへ",
            es: "Volver a la cuenta",
          })}
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
            ? tt({ en: "Close", ko: "닫기", ja: "閉じる", es: "Cerrar" })
            : tt({
                en: "New post",
                ko: "새 글 작성",
                ja: "新規投稿",
                es: "Nueva publicación",
              })}
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
                  {tt({ en: "Title", ko: "제목", ja: "タイトル", es: "Título" })}
                </span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={200}
                  className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
                  placeholder={
                    tt({
                      en: "e.g. Copy button not working",
                      ko: "예: 결과 복사가 안돼요",
                      ja: "例: コピーボタンが動きません",
                      es: "p. ej. El botón de copiar no funciona",
                    })
                  }
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-stone-700">
                  {tt({
                    en: "Category",
                    ko: "분류",
                    ja: "分類",
                    es: "Categoría",
                  })}
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
                {tt({
                  en: "Details",
                  ko: "내용",
                  ja: "内容",
                  es: "Detalles",
                })}
              </span>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                onPaste={handlePaste}
                rows={10}
                className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-teal-600"
                placeholder={tt({
                  en: "Describe the issue. Paste a screenshot here (Ctrl/⌘+V) and it will be attached as a preview below.",
                  ko: "무엇이 불편했는지 자세히 알려주세요. 캡처한 이미지를 이 영역에 바로 붙여넣으면(Ctrl/⌘+V) 아래에 미리보기로 첨부됩니다.",
                  ja: "問題の内容を詳しく教えてください。スクリーンショットをこの欄に貼り付ける（Ctrl/⌘+V）と、下にプレビューとして添付されます。",
                  es: "Describe el problema. Pega una captura aquí (Ctrl/⌘+V) y se adjuntará como vista previa abajo.",
                })}
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
                  ? tt({
                      en: "Uploading...",
                      ko: "업로드 중...",
                      ja: "アップロード中...",
                      es: "Subiendo...",
                    })
                  : tt({
                      en: "🖼 Attach image",
                      ko: "🖼 이미지 첨부",
                      ja: "🖼 画像を添付",
                      es: "🖼 Adjuntar imagen",
                    })}
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
                {tt({
                  en: "PNG, JPEG, WebP, GIF · up to 10MB",
                  ko: "PNG·JPEG·WebP·GIF, 최대 10MB",
                  ja: "PNG・JPEG・WebP・GIF、最大10MB",
                  es: "PNG, JPEG, WebP, GIF · hasta 10MB",
                })}
              </span>
            </div>

            {attachments.length ? (
              <div>
                <p className="mb-2 text-xs font-medium text-stone-500">
                  {tt({
                    en: `${attachments.length} attached image${attachments.length > 1 ? "s" : ""}`,
                    ko: `첨부 이미지 ${attachments.length}장`,
                    ja: `添付画像 ${attachments.length} 枚`,
                    es: `${attachments.length} imagen${attachments.length > 1 ? "es" : ""} adjunta${attachments.length > 1 ? "s" : ""}`,
                  })}
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
                        aria-label={tt({
                          en: "Remove image",
                          ko: "이미지 삭제",
                          ja: "画像を削除",
                          es: "Quitar imagen",
                        })}
                        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-stone-300 bg-white text-sm font-semibold text-stone-600 shadow-sm hover:bg-rose-50 hover:text-rose-600"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {submitting
                  ? tt({
                      en: "Submitting...",
                      ko: "등록 중...",
                      ja: "送信中...",
                      es: "Enviando...",
                    })
                  : tt({ en: "Submit", ko: "등록하기", ja: "送信", es: "Enviar" })}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-lg border border-stone-200 bg-white shadow-sm">
        <header className="border-b border-stone-200 px-5 py-3">
          <h2 className="text-base font-semibold text-stone-950">
            {tt({
              en: "My feedback",
              ko: "내 피드백",
              ja: "自分のフィードバック",
              es: "Mis comentarios",
            })}
          </h2>
        </header>
        {loading ? (
          <p className="px-5 py-6 text-sm text-stone-500">
            {tt({
              en: "Loading...",
              ko: "불러오는 중...",
              ja: "読み込み中...",
              es: "Cargando...",
            })}
          </p>
        ) : posts.length === 0 ? (
          <p className="px-5 py-6 text-sm text-stone-500">
            {tt({
              en: "You have not posted any feedback yet.",
              ko: "아직 작성한 글이 없습니다.",
              ja: "まだ投稿した内容がありません。",
              es: "Aún no has publicado ningún comentario.",
            })}
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
                        <span className="inline-flex h-2 w-2 flex-none rounded-full bg-rose-500" title={tt({
                        en: "New reply",
                        ko: "새 답변",
                        ja: "新しい返信",
                        es: "Nueva respuesta",
                      })} />
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-stone-500">
                      {categoryLabel(post.category, language)} ·{" "}
                      {formatFeedbackDate(post.createdAt, language)}
                      {post.commentCount > 0
                        ? ` · ${tt({
                            en: "replies",
                            ko: "답변",
                            ja: "返信",
                            es: "respuestas",
                          })} ${post.commentCount}`
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
