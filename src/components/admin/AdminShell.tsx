"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminSignOutButton } from "@/components/admin/AdminSignOutButton";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import type { CurrentAdmin } from "@/lib/admin-auth";

const navItems = [
  { href: "/admin", key: "dashboard" },
  { href: "/admin/users", key: "users" },
  { href: "/admin/conversations", key: "conversations" },
  { href: "/admin/coupons", key: "coupons" },
  { href: "/admin/providers", key: "providers" },
  { href: "/admin/audit-logs", key: "auditLogs" },
  { href: "/admin/about", key: "about" },
] as const;

const adminText = {
  en: {
    dashboard: "Dashboard",
    users: "Users",
    conversations: "Conversations",
    coupons: "Coupons",
    providers: "Provider Settings",
    auditLogs: "Audit Logs",
    about: "About",
    title: "Qkiki Admin",
    subtitle: "Operations Console",
    signedInAs: "Signed in as",
    role: "Role",
    mobileNavigation: "Admin navigation",
  },
  ko: {
    dashboard: "\uB300\uC2DC\uBCF4\uB4DC",
    users: "\uC0AC\uC6A9\uC790",
    conversations: "\uB300\uD654",
    coupons: "\uCFE0\uD3F0",
    providers: "\uACF5\uAE09\uC790 \uC124\uC815",
    auditLogs: "\uAC10\uC0AC \uB85C\uADF8",
    about: "\uC815\uBCF4",
    title: "Qkiki \uAD00\uB9AC\uC790",
    subtitle: "\uC6B4\uC601 \uCF58\uC194",
    signedInAs: "\uB85C\uADF8\uC778 \uACC4\uC815",
    role: "\uAD8C\uD55C",
    mobileNavigation: "\uAD00\uB9AC\uC790 \uB0B4\uBE44\uAC8C\uC774\uC158",
  },
} as const;

export function AdminShell({
  admin,
  children,
}: {
  admin: CurrentAdmin;
  children: React.ReactNode;
}) {
  const { language } = useLanguage();
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const t = adminText[language];

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  function isActiveHref(href: string) {
    if (href === "/admin") {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function navClassName(href: string, mobile = false) {
    const active = isActiveHref(href);
    const pending = pendingHref === href;
    const base = mobile
      ? "min-w-20 flex-1 rounded-md px-2 py-2 text-center text-xs font-semibold transition-colors"
      : "rounded-md px-3 py-2 text-sm font-medium transition-colors";

    if (pending) {
      return `${base} bg-teal-50 text-teal-800 ring-1 ring-teal-200`;
    }

    if (active) {
      return `${base} bg-slate-900 text-white`;
    }

    return `${base} text-slate-700 hover:bg-slate-100 hover:text-slate-950`;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {pendingHref ? (
        <div className="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-teal-100">
          <div className="h-full w-1/3 animate-pulse bg-teal-600" />
        </div>
      ) : null}
      <div className="mx-auto flex min-h-screen max-w-[1700px] flex-col lg:flex-row">
        <aside className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur lg:static lg:w-72 lg:border-b-0 lg:border-r lg:bg-white lg:px-5">
          <div className="flex items-center justify-between gap-4 lg:block">
            <Link href="/admin" className="block">
              <p className="text-lg font-semibold tracking-tight">{t.title}</p>
              <p className="text-xs text-slate-500">{t.subtitle}</p>
            </Link>
            <div className="lg:hidden">
              <AdminSignOutButton compact />
            </div>
          </div>

          <nav className="mt-5 hidden gap-2 lg:flex lg:flex-col">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActiveHref(item.href) ? "page" : undefined}
                onClick={() => {
                  if (!isActiveHref(item.href)) {
                    setPendingHref(item.href);
                  }
                }}
                className={navClassName(item.href)}
              >
                {t[item.key]}
              </Link>
            ))}
          </nav>

          <div className="mt-8 hidden rounded-lg border border-slate-200 bg-slate-50 p-3 lg:block">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t.signedInAs}
            </p>
            <p className="mt-2 truncate text-sm font-medium text-slate-950">
              {admin.name || admin.email}
            </p>
            <p className="truncate text-xs text-slate-500">{admin.email}</p>
            <p className="mt-1 text-xs text-slate-500">
              {t.role}: {admin.role}
            </p>
            <div className="mt-3">
              <AdminSignOutButton compact />
            </div>
          </div>
        </aside>

        <main className="flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-8">
          {children}
        </main>
      </div>

      <nav
        aria-label={t.mobileNavigation}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur lg:hidden"
      >
        <div className="mx-auto flex max-w-[620px] gap-1 overflow-x-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActiveHref(item.href) ? "page" : undefined}
              onClick={() => {
                if (!isActiveHref(item.href)) {
                  setPendingHref(item.href);
                }
              }}
              className={navClassName(item.href, true)}
            >
              {t[item.key]}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
