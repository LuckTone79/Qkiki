import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE_CANDIDATES,
  hasAnyCookie,
} from "@/lib/auth-constants";
import {
  buildCanonicalRedirectUrl,
  shouldRedirectToCanonicalHost,
} from "@/lib/canonical-host";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

function isAdminHost(host: string | null) {
  return Boolean(host && host.toLowerCase().startsWith("admin."));
}

function shouldRewriteToAdmin(pathname: string) {
  return (
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/_next") &&
    pathname !== "/favicon.ico"
  );
}

/** Copies cookies set on `source` (the Supabase session refresh) onto a
 * different response we're about to return — a redirect and `next()` are
 * separate response objects, so refreshed auth cookies would otherwise be
 * dropped whenever this proxy redirects instead of passing the request
 * straight through. */
function withRefreshedCookies(response: NextResponse, source: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host");
  const hostname = host?.split(":")[0]?.trim().toLowerCase() || request.nextUrl.hostname;

  const { response: refreshedResponse, user: supabaseUser } =
    await updateSupabaseSession(request);

  // Real users now carry a Supabase session instead of the legacy cookie;
  // trial (anonymous) users still only ever have the legacy cookie.
  const hasUserSession =
    Boolean(supabaseUser) ||
    hasAnyCookie(request.cookies, SESSION_COOKIE_CANDIDATES);
  // Coarse "is anyone logged in" pre-filter only — the actual admin role
  // check (User.role) is a DB lookup and happens in requireAdminViewer(),
  // not here, per Next.js's guidance to keep proxy checks optimistic.
  const hasAdminSession = Boolean(supabaseUser);

  if (isAdminHost(host) && shouldRewriteToAdmin(pathname)) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/admin${pathname === "/" ? "" : pathname}`;
    return withRefreshedCookies(NextResponse.rewrite(rewriteUrl), refreshedResponse);
  }

  if (
    !shouldRedirectToCanonicalHost({
      env: process.env,
      hostname,
      pathname,
      method: request.method,
    })
  ) {
    if (pathname.startsWith("/app") && !hasUserSession) {
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("next", pathname);
      return withRefreshedCookies(NextResponse.redirect(signInUrl), refreshedResponse);
    }

    if ((pathname === "/sign-in" || pathname === "/sign-up") && hasUserSession) {
      return withRefreshedCookies(
        NextResponse.redirect(new URL("/app/workbench", request.url)),
        refreshedResponse,
      );
    }

    if (pathname.startsWith("/admin") && pathname !== "/admin/sign-in" && !hasAdminSession) {
      const signInUrl = new URL("/admin/sign-in", request.url);
      signInUrl.searchParams.set("next", pathname);
      return withRefreshedCookies(NextResponse.redirect(signInUrl), refreshedResponse);
    }

    return refreshedResponse;
  }

  const redirectUrl = buildCanonicalRedirectUrl(request.url, process.env);
  if (!redirectUrl) {
    return refreshedResponse;
  }

  if (hasUserSession) {
    const handoffUrl = new URL("/api/auth/handoff", request.url);
    handoffUrl.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search || ""}`,
    );
    return withRefreshedCookies(NextResponse.redirect(handoffUrl, 307), refreshedResponse);
  }

  return withRefreshedCookies(NextResponse.redirect(redirectUrl, 308), refreshedResponse);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff|woff2)$).*)",
  ],
};
