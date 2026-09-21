import { NextResponse } from "next/server";
import { sanitizeNextPath } from "@/lib/auth-next-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureLegacyUserLinked } from "@/lib/supabase/link-legacy-user";

/**
 * Single landing point for every Supabase Auth email link and OAuth
 * redirect (sign-up confirmation, password recovery, Google/Kakao). Trades
 * the one-time `code` for a real session, then continues to `next`.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = sanitizeNextPath(requestUrl.searchParams.get("next"));

  if (requestUrl.searchParams.get("error")) {
    return NextResponse.redirect(new URL("/sign-in?error=oauth_failed", request.url));
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/sign-in?error=oauth_failed", request.url));
    }

    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      return NextResponse.redirect(new URL("/sign-in?error=oauth_failed", request.url));
    }

    try {
      await ensureLegacyUserLinked(data.user);
    } catch (error) {
      await supabase.auth.signOut();
      const code = error instanceof Error && "code" in error
        ? String((error as Error & { code?: string }).code)
        : "oauth_failed";
      const redirectUrl = new URL("/sign-in", request.url);
      redirectUrl.searchParams.set("error", code);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
