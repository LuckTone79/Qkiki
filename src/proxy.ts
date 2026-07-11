import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE_CANDIDATES,
  USER_SESSION_COOKIE_CANDIDATES,
} from "@/lib/auth-constants";
import {
  buildCanonicalRedirectUrl,
  shouldRedirectToCanonicalHost,
} from "@/lib/canonical-host";
import { isTrustedMutationRequest } from "@/lib/request-security";

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
    "worker-src 'self' blob:",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self' https://yapp.wideget.net",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  return { csp, nonce, requestHeaders };
}

function secureResponse(response: NextResponse, csp: string) {
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set("Origin-Agent-Cluster", "?1");
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host");
  const hostname =
    host?.split(":")[0]?.trim().toLowerCase() || request.nextUrl.hostname;
  const hasUserSession = USER_SESSION_COOKIE_CANDIDATES.some((name) =>
    request.cookies.has(name),
  );
  const hasAdminSession = ADMIN_SESSION_COOKIE_CANDIDATES.some((name) =>
    request.cookies.has(name),
  );
  const { csp, requestHeaders } = buildRequestSecurityHeaders(request);
  const secure = (response: NextResponse) => secureResponse(response, csp);

  if (!isTrustedMutationRequest(request)) {
    return secure(
      NextResponse.json(
        { error: "Cross-origin mutation rejected." },
        { status: 403, headers: { "Cache-Control": "private, no-store" } },
      ),
    );
  }

  if (isAdminHost(host) && shouldRewriteToAdmin(pathname)) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/admin${pathname === "/" ? "" : pathname}`;
    return secure(
      NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } }),
    );
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
      return secure(NextResponse.redirect(signInUrl));
    }

    if (
      pathname.startsWith("/admin") &&
      pathname !== "/admin/sign-in" &&
      !hasAdminSession
    ) {
      const signInUrl = new URL("/admin/sign-in", request.url);
      signInUrl.searchParams.set("next", pathname);
      return secure(NextResponse.redirect(signInUrl));
    }

    return secure(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  const redirectUrl = buildCanonicalRedirectUrl(request.url, process.env);
  if (!redirectUrl) {
    return secure(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  if (hasUserSession) {
    const handoffUrl = new URL("/api/auth/handoff", request.url);
    handoffUrl.searchParams.set("next", `${pathname}${request.nextUrl.search || ""}`);
    return secure(NextResponse.redirect(handoffUrl, 307));
  }

  return secure(NextResponse.redirect(redirectUrl, 308));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff|woff2)$).*)",
  ],
};
