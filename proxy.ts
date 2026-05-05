import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, SESSION_COOKIE } from "@/lib/auth-constants";

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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host");
  const hasUserSession = request.cookies.has(SESSION_COOKIE);
  const hasAdminSession = request.cookies.has(ADMIN_SESSION_COOKIE);

  if (isAdminHost(host) && shouldRewriteToAdmin(pathname)) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/admin${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(rewriteUrl);
  }

  if (pathname.startsWith("/app") && !hasUserSession) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if ((pathname === "/sign-in" || pathname === "/sign-up") && hasUserSession) {
    return NextResponse.redirect(new URL("/app/workbench", request.url));
  }

  if (pathname.startsWith("/admin") && pathname !== "/admin/sign-in" && !hasAdminSession) {
    const signInUrl = new URL("/admin/sign-in", request.url);
    signInUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (pathname === "/admin/sign-in" && hasAdminSession) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
