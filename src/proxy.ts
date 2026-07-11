import { NextRequest, NextResponse } from "next/server";
import { USER_SESSION_COOKIE_CANDIDATES } from "@/lib/auth-constants";
import { buildCanonicalRedirectUrl, shouldRedirectToCanonicalHost } from "@/lib/canonical-host";
import { isTrustedMutationRequest } from "@/lib/request-security";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

function isAdminHost(host: string | null) {
  return Boolean(host && host.toLowerCase().startsWith("admin."));
}

function shouldRewriteToAdmin(pathname: string) {
  return !pathname.startsWith("/admin") && !pathname.startsWith("/api") &&
    !pathname.startsWith("/_next") && pathname !== "/favicon.ico";
}

function buildRequestSecurityHeaders(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const isProduction = process.env.NODE_ENV === "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProduction ? "" : " 'unsafe-eval'"}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://images.unsplash.com",
    "font-src 'self' data:",
    `connect-src 'self'${isProduction ? "" : " ws: wss:"}`,
    "worker-src 'self' blob:", "object-src 'none'", "frame-src 'none'",
    "frame-ancestors 'none'", "base-uri 'none'",
    "form-action 'self' https://yapp.wideget.net",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  return { csp, requestHeaders };
}

function secureResponse(
  response: NextResponse,
  csp: string,
  supabaseResponse: NextResponse | null,
) {
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set("Origin-Agent-Cluster", "?1");
  if (supabaseResponse) {
    for (const cookie of supabaseResponse.cookies.getAll()) response.cookies.set(cookie);
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host");
  const hostname = host?.split(":")[0]?.trim().toLowerCase() || request.nextUrl.hostname;
  const { csp, requestHeaders } = buildRequestSecurityHeaders(request);
  let supabaseResponse: NextResponse | null = null;
  let supabaseUser: unknown = null;
  const secure = (response: NextResponse) => secureResponse(response, csp, supabaseResponse);

  if (!isTrustedMutationRequest(request)) {
    return secure(NextResponse.json(
      { error: "Cross-origin mutation rejected." },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    ));
  }

  if (isSupabaseConfigured()) {
    try {
      const refreshed = await updateSupabaseSession(request);
      supabaseResponse = refreshed.response;
      supabaseUser = refreshed.user;
    } catch {
      return secure(NextResponse.json(
        { error: "Authentication service unavailable." },
        { status: 503, headers: { "Cache-Control": "private, no-store" } },
      ));
    }
  }

  const hasUserSession = Boolean(supabaseUser) || USER_SESSION_COOKIE_CANDIDATES.some((name) => request.cookies.has(name));

  if (isAdminHost(host) && shouldRewriteToAdmin(pathname)) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/admin${pathname === "/" ? "" : pathname}`;
    return secure(NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } }));
  }

  if (!shouldRedirectToCanonicalHost({ env: process.env, hostname, pathname, method: request.method })) {
    if (pathname.startsWith("/app") && !hasUserSession) {
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("next", pathname);
      return secure(NextResponse.redirect(signInUrl));
    }
    if (pathname.startsWith("/admin") && pathname !== "/admin/sign-in" && !hasUserSession) {
      const signInUrl = new URL("/admin/sign-in", request.url);
      signInUrl.searchParams.set("next", pathname);
      return secure(NextResponse.redirect(signInUrl));
    }
    return secure(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  const redirectUrl = buildCanonicalRedirectUrl(request.url, process.env);
  if (!redirectUrl || hasUserSession) {
    return secure(NextResponse.next({ request: { headers: requestHeaders } }));
  }
  return secure(NextResponse.redirect(redirectUrl, 308));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff|woff2)$).*)"],
};
