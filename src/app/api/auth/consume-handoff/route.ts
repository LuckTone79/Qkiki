import { NextResponse } from "next/server";
import { createAuthSession } from "@/lib/auth";
import { readAuthHandoffToken } from "@/lib/auth-handoff";
import { prisma } from "@/lib/prisma";

function buildFallbackSignInRedirect(requestUrl: string, nextPath: string) {
  const redirectUrl = new URL("/sign-in", requestUrl);
  redirectUrl.searchParams.set("next", nextPath);
  redirectUrl.searchParams.set("reason", "session_transfer_required");
  return redirectUrl;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const payload = readAuthHandoffToken(requestUrl.searchParams.get("token"));
  const fallbackRedirect = buildFallbackSignInRedirect(
    request.url,
    requestUrl.searchParams.get("next") || "/app/workbench",
  );

  if (!payload) {
    return NextResponse.redirect(fallbackRedirect);
  }

  const sourceSession = await prisma.authSession.findUnique({
    where: { tokenHash: payload.sessionTokenHash },
    include: { user: true },
  });

  if (
    !sourceSession ||
    sourceSession.userId !== payload.userId ||
    sourceSession.expiresAt.getTime() < Date.now() ||
    sourceSession.user.status === "SUSPENDED"
  ) {
    fallbackRedirect.searchParams.set("next", payload.nextPath);
    return NextResponse.redirect(fallbackRedirect);
  }

  await prisma.authSession.delete({
    where: { tokenHash: payload.sessionTokenHash },
  });

  await createAuthSession(payload.userId);
  return NextResponse.redirect(new URL(payload.nextPath, request.url));
}
