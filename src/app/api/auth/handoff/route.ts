import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { LEGACY_SESSION_COOKIE, SESSION_COOKIE } from "@/lib/auth-constants";
import { createAuthHandoffToken, sanitizeInternalReturnPath } from "@/lib/auth-handoff";
import { buildCanonicalRedirectUrl } from "@/lib/canonical-host";
import { hashSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function buildCanonicalSignInRedirect(requestUrl: string, nextPath: string) {
  const redirectUrl = buildCanonicalRedirectUrl(requestUrl);
  if (!redirectUrl) {
    return new URL("/sign-in", requestUrl);
  }

  redirectUrl.pathname = "/sign-in";
  redirectUrl.search = "";
  redirectUrl.searchParams.set("next", nextPath);
  return redirectUrl;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const nextPath = sanitizeInternalReturnPath(requestUrl.searchParams.get("next"));
  const canonicalBase = buildCanonicalRedirectUrl(request.url);

  if (!canonicalBase) {
    return NextResponse.redirect(new URL(nextPath, request.url));
  }

  const cookieStore = await cookies();
  const sessionToken =
    cookieStore.get(SESSION_COOKIE)?.value ??
    cookieStore.get(LEGACY_SESSION_COOKIE)?.value;
  if (!sessionToken) {
    return NextResponse.redirect(buildCanonicalSignInRedirect(request.url, nextPath));
  }

  const sessionTokenHash = hashSessionToken(sessionToken);
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: sessionTokenHash },
    include: { user: true },
  });

  if (
    !session ||
    session.expiresAt.getTime() < Date.now() ||
    session.user.status === "SUSPENDED"
  ) {
    return NextResponse.redirect(buildCanonicalSignInRedirect(request.url, nextPath));
  }

  const handoffToken = createAuthHandoffToken({
    sessionTokenHash,
    userId: session.userId,
    nextPath,
  });

  canonicalBase.pathname = "/api/auth/consume-handoff";
  canonicalBase.search = "";
  canonicalBase.searchParams.set("token", handoffToken);
  return NextResponse.redirect(canonicalBase, 307);
}
