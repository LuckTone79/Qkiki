import { NextResponse } from "next/server";
import { sanitizeNextPath } from "@/lib/auth-next-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SUPPORTED_PROVIDERS = ["google", "kakao"] as const;
type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

function isSupportedProvider(value: string): value is SupportedProvider {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Same-origin OAuth entry point (`/api/auth/oauth/google`, `/…/kakao`).
 * Kept as a real, linkable URL — rather than calling
 * `supabase.auth.signInWithOAuth` directly from the client — so the
 * embedded-browser "open in system browser" flow (KakaoTalk/Instagram
 * webviews block Google's OAuth policy) keeps working exactly as before.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;

  if (!isSupportedProvider(provider)) {
    return NextResponse.redirect(new URL("/sign-in?error=oauth_failed", request.url));
  }

  const requestUrl = new URL(request.url);
  const next = sanitizeNextPath(requestUrl.searchParams.get("next"));
  const redirectTo = new URL("/auth/callback", requestUrl.origin);
  redirectTo.searchParams.set("next", next);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectTo.toString(),
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL("/sign-in?error=oauth_failed", request.url));
  }

  return NextResponse.redirect(data.url);
}
