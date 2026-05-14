import { NextResponse } from "next/server";
import { buildOpenInBrowserPath, isLikelyEmbeddedBrowser } from "@/lib/browser-detection";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  createGoogleOAuthState,
  getGoogleOAuthConfig,
  sanitizePostAuthPath,
} from "@/lib/google-oauth";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

export async function GET(request: Request) {
  const config = getGoogleOAuthConfig(request.url);
  if (!config) {
    return NextResponse.redirect(new URL("/sign-in?error=google_not_configured", request.url));
  }

  const requestUrl = new URL(request.url);
  const nextPath = sanitizePostAuthPath(requestUrl.searchParams.get("next"));
  const embeddedTarget = `/api/auth/google/start?next=${encodeURIComponent(nextPath)}`;
  const userAgent = request.headers.get("user-agent");

  if (isLikelyEmbeddedBrowser(userAgent)) {
    return NextResponse.redirect(
      new URL(buildOpenInBrowserPath(embeddedTarget), request.url),
    );
  }

  const oauthState = createGoogleOAuthState(nextPath);

  const googleUrl = new URL(GOOGLE_AUTH_ENDPOINT);
  googleUrl.searchParams.set("client_id", config.clientId);
  googleUrl.searchParams.set("redirect_uri", config.redirectUri);
  googleUrl.searchParams.set("response_type", "code");
  googleUrl.searchParams.set("scope", "openid email profile");
  googleUrl.searchParams.set("prompt", "select_account");
  googleUrl.searchParams.set("state", oauthState.state);

  const response = NextResponse.redirect(googleUrl);
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, oauthState.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: oauthState.maxAgeSeconds,
    path: "/",
  });

  return response;
}
