"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buildAndroidIntentUrl } from "@/lib/browser-detection";

type OpenInBrowserClientProps = {
  targetPath: string;
};

export function OpenInBrowserClient({
  targetPath,
}: OpenInBrowserClientProps) {
  const [copied, setCopied] = useState(false);
  const absoluteTarget = useMemo(() => {
    if (typeof window === "undefined") {
      return targetPath;
    }

    return new URL(targetPath, window.location.origin).toString();
  }, [targetPath]);
  const androidIntentUrl = useMemo(
    () => buildAndroidIntentUrl(absoluteTarget),
    [absoluteTarget],
  );
  const isAndroid =
    typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(absoluteTarget);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12 text-stone-900">
      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold tracking-[0.18em] text-teal-700">
          GOOGLE SIGN-IN
        </p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight">
          인앱 브라우저에서는 Google 로그인이 차단될 수 있습니다.
        </h1>
        <p className="mt-4 text-sm leading-6 text-stone-600">
          카카오톡, 인스타그램, 페이스북 같은 앱 안 브라우저는 Google의
          보안 정책 때문에 <span className="font-semibold">disallowed_useragent</span>
          {" "}오류가 날 수 있습니다. 아래 버튼으로 Chrome, Safari 같은 기본
          브라우저에서 다시 열어주세요.
        </p>

        <div className="mt-6 space-y-3">
          {isAndroid ? (
            <a
              href={androidIntentUrl}
              className="block rounded-xl bg-stone-950 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-stone-800"
            >
              Chrome으로 열기
            </a>
          ) : null}
          <a
            href={absoluteTarget}
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl border border-stone-300 px-4 py-3 text-center text-sm font-semibold text-stone-800 hover:bg-stone-50"
          >
            기본 브라우저에서 열기
          </a>
          <button
            type="button"
            onClick={copyLink}
            className="block w-full rounded-xl border border-stone-300 px-4 py-3 text-center text-sm font-semibold text-stone-800 hover:bg-stone-50"
          >
            {copied ? "링크 복사됨" : "로그인 링크 복사"}
          </button>
        </div>

        <div className="mt-6 rounded-2xl bg-stone-50 p-4 text-sm leading-6 text-stone-700">
          <p className="font-semibold text-stone-900">빠른 해결 방법</p>
          <p className="mt-2">
            1. 카카오톡/인스타 앱의 메뉴에서 <span className="font-semibold">브라우저로 열기</span>
            {" "}또는 <span className="font-semibold">Chrome에서 열기</span>를 선택합니다.
          </p>
          <p>
            2. 다시 열린 브라우저에서 Google 로그인을 진행합니다.
          </p>
        </div>

        <div className="mt-6">
          <Link
            href="/sign-in?error=google_secure_browser_required"
            className="text-sm font-medium text-teal-700 hover:text-teal-900"
          >
            로그인 화면으로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}
