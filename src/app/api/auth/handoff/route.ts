import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAuthHandoffToken, sanitizeInternalReturnPath } from "@/lib/auth-handoff";
import { hashSessionToken } from "@/lib/auth";
import { USER_SESSION_COOKIE_CANDIDATES } from "@/lib/auth-constants";
import { buildCanonicalRedirectUrl } from "@/lib/canonical-host";
import { prisma } from "@/lib/prisma";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
};

function redirectNoStore(url: URL) {
  return NextResponse.redirect(url, { status: 307, headers: PRIVATE_HEADERS });
}

function buildCanonicalSignInRedirect(requestUrl: string, nextPath: string) {
  const redirectUrl = buildCanonicalRedirectUrl(requestUrl) ?? new URL("/sign-in", requestUrl);
  redirectUrl.pathname = "/sign-in";
  redirectUrl.search = "";
  redirectUrl.searchParams.set("next", nextPath);
  return redirectUrl;
}

function handoffFormResponse(action: string, token: string, requestNonce: string | null) {
  const nonce = requestNonce || crypto.randomBytes(18).toString("base64");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Continuing to Yapp</title></head><body><form id="handoff" method="post" action="${action}"><input type="hidden" name="token" value="${token}"><noscript><button type="submit">Continue securely</button></noscript></form><script nonce="${nonce}">document.getElementById("handoff").submit()</script></body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      ...PRIVATE_HEADERS,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; form-action ${new URL(action).origin}; base-uri 'none'; frame-ancestors 'none'`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const nextPath = sanitizeInternalReturnPath(requestUrl.searchParams.get("next"));
  const canonicalBase = buildCanonicalRedirectUrl(request.url);

  if (!canonicalBase) {
    return redirectNoStore(new URL(nextPath, request.url));
  }

  const cookieStore = await cookies();
  const sessionToken = USER_SESSION_COOKIE_CANDIDATES
    .map((cookieName) => cookieStore.get(cookieName)?.value)
    .find(Boolean);
  if (!sessionToken) {
    return redirectNoStore(buildCanonicalSignInRedirect(request.url, nextPath));
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
    return redirectNoStore(buildCanonicalSignInRedirect(request.url, nextPath));
  }

  const handoffToken = createAuthHandoffToken({
    sessionTokenHash,
    userId: session.userId,
    nextPath,
  });
  canonicalBase.pathname = "/api/auth/consume-handoff";
  canonicalBase.search = "";
  return handoffFormResponse(
    canonicalBase.toString(),
    handoffToken,
    request.headers.get("x-nonce"),
  );
}
