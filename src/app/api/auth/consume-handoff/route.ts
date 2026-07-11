import { NextResponse } from "next/server";
import { createAuthSession } from "@/lib/auth";
import { readAuthHandoffToken } from "@/lib/auth-handoff";
import { prisma } from "@/lib/prisma";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
};

function fallbackRedirect(requestUrl: string, nextPath = "/app/workbench") {
  const redirectUrl = new URL("/sign-in", requestUrl);
  redirectUrl.searchParams.set("next", nextPath);
  redirectUrl.searchParams.set("reason", "session_transfer_required");
  return NextResponse.redirect(redirectUrl, { status: 303, headers: PRIVATE_HEADERS });
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed." },
    { status: 405, headers: { ...PRIVATE_HEADERS, Allow: "POST" } },
  );
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 4_096) {
    return NextResponse.json(
      { error: "Request is too large." },
      { status: 413, headers: PRIVATE_HEADERS },
    );
  }

  const form = await request.formData().catch(() => null);
  const rawToken = form?.get("token");
  const token = typeof rawToken === "string" && rawToken.length <= 2_048 ? rawToken : null;
  const payload = readAuthHandoffToken(token);
  if (!payload) {
    return fallbackRedirect(request.url);
  }

  const consumed = await prisma.$transaction(async (tx) => {
    const sourceSession = await tx.authSession.findUnique({
      where: { tokenHash: payload.sessionTokenHash },
      include: { user: true },
    });
    if (
      !sourceSession ||
      sourceSession.userId !== payload.userId ||
      sourceSession.expiresAt.getTime() < Date.now() ||
      sourceSession.user.status === "SUSPENDED"
    ) {
      return false;
    }

    const deleted = await tx.authSession.deleteMany({
      where: {
        tokenHash: payload.sessionTokenHash,
        userId: payload.userId,
        expiresAt: { gt: new Date() },
      },
    });
    return deleted.count === 1;
  });

  if (!consumed) {
    return fallbackRedirect(request.url, payload.nextPath);
  }

  await createAuthSession(payload.userId);
  return NextResponse.redirect(new URL(payload.nextPath, request.url), {
    status: 303,
    headers: PRIVATE_HEADERS,
  });
}
