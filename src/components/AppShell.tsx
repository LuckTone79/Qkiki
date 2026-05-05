"use client";

import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import type { CurrentUser } from "@/lib/auth";

const navItems = [
  { href: "/app/workbench", key: "workbench" },
  { href: "/app/projects", key: "projects" },
  { href: "/app/sessions", key: "sessions" },
  { href: "/app/presets", key: "presets" },
  { href: "/app/account", key: "account" },
] as const;

export function AppShell({
  user,
  projects = [],
  children,
}: {
  user: CurrentUser;
  projects?: Array<{ id: string; name: string }>;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#f7f8f3] text-stone-950">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col lg:flex-row">
        <aside className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 px-4 py-4 backdrop-blur lg:static lg:w-64 lg:border-b-0 lg:border-r lg:bg-white/80 lg:px-5">
          <div className="flex items-center justify-between gap-4 lg:block">
            <Link href="/app/workbench" className="block">
              <p className="text-lg font-semibold tracking-tight">Qkiki</p>
              <p className="text-xs text-stone-500">
                {t("orchestrationWorkbench")}
              </p>
            </Link>
            <div className="lg:hidden">
              <SignOutButton compact />
            </div>
          </div>

          <nav className="mt-5 hidden gap-2 lg:flex lg:flex-col">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-stone-700 hover:bg-[#e9f7ef] hover:text-stone-950"
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>

          <div className="mt-6 hidden lg:block">
            <div className="flex items-center justify-between gap-2 px-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                {t("projects")}
              </p>
              <Link
                href="/app/projects?create=1"
                className="text-xs font-semibold text-teal-700 hover:text-teal-900"
              >
                {t("new")}
              </Link>
            </div>
            <div className="mt-2 space-y-1">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/app/projects/${project.id}`}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-stone-700 hover:bg-[#e9f7ef] hover:text-stone-950"
                >
                  <span className="text-stone-400">[ ]</span>
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

          <div className="mt-8 hidden rounded-lg border border-stone-200 bg-[#fbfcf8] p-3 lg:block">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              {t("signedIn")}
            </p>
            <p className="mt-2 truncate text-sm font-medium text-stone-950">
              {user.name || user.email}
            </p>
            <p className="truncate text-xs text-stone-500">{user.email}</p>
            <div className="mt-3">
              <SignOutButton compact />
            </div>
          </div>
        </aside>

        <main className="flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-8">
          {children}
        </main>
      </div>

      <nav
        aria-label={t("mobileNavigation")}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden"
      >
        <div className="mx-auto flex max-w-[560px] gap-1 overflow-x-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="min-w-20 flex-1 rounded-md px-2 py-2 text-center text-xs font-semibold text-stone-700 hover:bg-[#e9f7ef] hover:text-stone-950"
            >
              {t(item.key)}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
