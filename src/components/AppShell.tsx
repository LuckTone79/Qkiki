"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthEntryLinks } from "@/components/AuthEntryLinks";
import { SignOutButton } from "@/components/SignOutButton";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import type { CurrentUser } from "@/lib/auth";
import {
  readBrowserStorageValue,
  writeBrowserStorageValue,
} from "@/lib/browser-storage";
import { shouldShowAuthEntryPoints } from "@/lib/trial-user";
import { APP_VERSION } from "@/lib/version";
import { buildNewWorkbenchPath, NEW_WORKBENCH_EVENT } from "@/lib/workbench-sharing";
import { prefetchOnIntent } from "@/lib/navigation-prefetch";

const navItems = [
  { href: buildNewWorkbenchPath(), key: "workbench", icon: "🧪" },
  { href: "/app/projects", key: "projects", icon: "🗂️" },
  { href: "/app/sessions", key: "sessions", icon: "📄" },
  { href: "/app/presets", key: "presets", icon: "⚡" },
  { href: "/guide", key: "guide", icon: "📘" },
  { href: "/app/account", key: "account", icon: "👤" },
  { href: "/app/account/feedback", key: "feedback", icon: "💬" },
] as const;

export function AppShell({
  user,
  projects = [],
  recentSessions = [],
  children,
}: {
  user: CurrentUser;
  projects?: Array<{ id: string; name: string }>;
  recentSessions?: Array<{ id: string; title: string }>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { language, t } = useLanguage();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const stored = readBrowserStorageValue("qkiki-sidebar-collapsed");
    setSidebarCollapsed(stored === "true");
  }, []);

  useEffect(() => {
    writeBrowserStorageValue(
      "qkiki-sidebar-collapsed",
      sidebarCollapsed ? "true" : "false",
    );
  }, [sidebarCollapsed]);

  const sidebarToggleLabel =
    language === "ko"
      ? sidebarCollapsed
        ? "왼쪽 메뉴 펼치기"
        : "왼쪽 메뉴 접기"
      : sidebarCollapsed
        ? "Expand left menu"
        : "Collapse left menu";
  const versionLabel = language === "ko" ? "버전" : "Version";
  const recentSessionsLabel = language === "ko" ? "최근 작업" : "Recent work";
  const visibleRecentSessions = recentSessions.slice(0, 10);
  const hasMoreRecentSessions = recentSessions.length > 10;
  const showAuthEntryLinks = shouldShowAuthEntryPoints(user);
  const requestNewWorkbench = () => {
    window.dispatchEvent(new Event(NEW_WORKBENCH_EVENT));
  };
  const prefetchDynamicHref = (href: string) => {
    prefetchOnIntent(router, href);
  };

  return (
    <div className="min-h-screen bg-[#ffffff] text-stone-950">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col lg:flex-row">
        <div
          className={`relative transition-[width] duration-200 lg:flex-none ${
            sidebarCollapsed ? "lg:w-0" : "lg:w-64"
          }`}
        >
          <aside
            className={`sticky top-0 z-40 border-b border-stone-200 bg-white/95 px-4 py-4 backdrop-blur transition-[width,padding,opacity] duration-200 lg:static lg:border-b-0 lg:border-r lg:bg-white/80 lg:px-5 ${
              sidebarCollapsed
                ? "lg:w-0 lg:overflow-hidden lg:border-r-0 lg:px-0 lg:py-0 lg:opacity-0"
                : "lg:w-64"
            }`}
          >
            <div className="flex items-center justify-between gap-4 lg:block">
              <Link
                href={buildNewWorkbenchPath()}
                onClick={requestNewWorkbench}
                className="block"
              >
                <p className="flex items-center gap-2 font-serif text-xl font-semibold tracking-tight">
                  <span aria-hidden="true">⬡</span> Yapp
                </p>
                <p className="mt-0.5 text-xs text-stone-500">
                  {t("orchestrationWorkbench")}
                </p>
              </Link>
              <div className="lg:hidden">
                {showAuthEntryLinks ? (
                  <AuthEntryLinks compact />
                ) : (
                  <SignOutButton compact />
                )}
              </div>
            </div>

            <nav className="mt-5 hidden gap-2 lg:flex lg:flex-col">
              {navItems.map((item) => (
                <div key={item.href}>
                  <Link
                    href={item.href}
                    onClick={item.key === "workbench" ? requestNewWorkbench : undefined}
                    className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium text-stone-700 hover:bg-[#f1f0ee] hover:text-stone-950"
                  >
                    <span aria-hidden="true" className="text-[15px] leading-none opacity-80">
                      {item.icon}
                    </span>
                    {t(item.key)}
                  </Link>
                  {item.key === "sessions" && visibleRecentSessions.length ? (
                    <div className="mt-1 space-y-1 border-l border-stone-200 pl-4">
                      <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                        {recentSessionsLabel}
                      </p>
                      {visibleRecentSessions.map((session) => (
                        <Link
                          key={session.id}
                          href={`/app/workbench?session=${session.id}`}
                          prefetch={false}
                          onMouseEnter={() =>
                            prefetchDynamicHref(`/app/workbench?session=${session.id}`)
                          }
                          onFocus={() =>
                            prefetchDynamicHref(`/app/workbench?session=${session.id}`)
                          }
                          className="block rounded-md px-2 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-950"
                          title={session.title}
                        >
                          <span className="block truncate">{session.title}</span>
                        </Link>
                      ))}
                      {hasMoreRecentSessions ? (
                        <Link
                          href="/app/sessions"
                          className="block rounded-md px-2 py-1.5 text-xs font-semibold text-stone-500 hover:bg-stone-100 hover:text-stone-950"
                        >
                          ...
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </nav>

            <div className="mt-6 hidden lg:block">
              <div className="flex items-center justify-between gap-2 px-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">
                  {t("projects")}
                </p>
                <Link
                  href="/app/projects?create=1"
                  className="text-xs font-semibold text-stone-600 hover:text-stone-950"
                >
                  {t("new")}
                </Link>
              </div>
              <div className="mt-2 space-y-1">
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/app/projects/${project.id}`}
                    prefetch={false}
                    onMouseEnter={() =>
                      prefetchDynamicHref(`/app/projects/${project.id}`)
                    }
                    onFocus={() =>
                      prefetchDynamicHref(`/app/projects/${project.id}`)
                    }
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-stone-700 hover:bg-[#f1f0ee] hover:text-stone-950"
                  >
                    <span aria-hidden="true" className="text-[13px] opacity-70">📁</span>
                    <span className="truncate">{project.name}</span>
                  </Link>
                ))}
                <Link
                  href="/app/projects"
                  className="block rounded-md px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-950"
                >
                  {t("more")}
                </Link>
              </div>
            </div>

            <div className="mt-8 hidden rounded-md border border-stone-200 bg-[#f7f6f3] p-3 lg:block">
              {showAuthEntryLinks ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">
                    {t("signIn")}
                  </p>
                  <AuthEntryLinks />
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">
                    {t("signedIn")}
                  </p>
                  <p className="mt-2 truncate text-sm font-medium text-stone-950">
                    {user.name || user.email}
                  </p>
                  <p className="truncate text-xs text-stone-500">{user.email}</p>
                  <div className="mt-3">
                    <SignOutButton compact />
                  </div>
                </>
              )}
              <p className="mt-3 text-xs text-stone-500">
                {versionLabel} {APP_VERSION}
              </p>
            </div>
          </aside>

          <button
            type="button"
            aria-label={sidebarToggleLabel}
            title={sidebarToggleLabel}
            onClick={() => setSidebarCollapsed((current) => !current)}
            className="absolute right-[-14px] top-8 z-50 hidden h-8 w-8 items-center justify-center rounded-full border border-stone-300 bg-white text-sm font-semibold text-stone-600 shadow-sm transition hover:bg-stone-50 lg:flex"
          >
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              className={`h-4 w-4 transition-transform ${
                sidebarCollapsed ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 3 5 8l5 5" />
            </svg>
          </button>
        </div>

        <main className="flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-8">
          <div className="mb-4 hidden items-center justify-end lg:flex">
            <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-500">
              {versionLabel} {APP_VERSION}
            </span>
          </div>
          {children}
        </main>
      </div>

      <nav
        aria-label={t("mobileNavigation")}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 px-1 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden"
      >
        <div className="flex w-full gap-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={item.key === "workbench" ? requestNewWorkbench : undefined}
              className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md px-0.5 py-1.5 text-center text-[10px] font-semibold leading-tight tracking-tight text-stone-700 hover:bg-[#f1f0ee] hover:text-stone-950"
            >
              <span aria-hidden="true" className="text-base leading-none">
                {item.icon}
              </span>
              <span className="block w-full truncate">{t(item.key)}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
