import crypto from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createAuthSession, getInitialRoleForEmail, hashPassword } from "@/lib/auth";
import {
  GOOGLE_OAUTH_PROVIDER,
  GOOGLE_OAUTH_STATE_COOKIE,
  getGoogleOAuthConfig,
  validateGoogleOAuthState,
} from "@/lib/google-oauth";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
};

function signInErrorRedirect(requestUrl: string, errorCode: string) {
  const redirectUrl = new URL("/sign-in", requestUrl);
  redirectUrl.searchParams.set("error", errorCode);
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
  return response;
}

function isEmailVerified(value: GoogleUserInfo["email_verified"]) {
  return value === true || value === "true";
}

export async function GET(request: Request) {
  const config = getGoogleOAuthConfig(request.url);
  if (!config) {
    return signInErrorRedirect(request.url, "google_not_configured");
  }

  const callbackUrl = new URL(request.url);
  const oauthError = callbackUrl.searchParams.get("error");
  if (oauthError) {
    return signInErrorRedirect(request.url, "google_authorization_denied");
  }

  const code = callbackUrl.searchParams.get("code");
  const state = callbackUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const stateToken = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  const statePayload = validateGoogleOAuthState(stateToken, state);

  if (!code || !statePayload) {
    return signInErrorRedirect(request.url, "google_state_invalid");
  }

  const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = (await tokenResponse.json().catch(() => ({}))) as GoogleTokenResponse;
  if (!tokenResponse.ok || !tokenData.access_token) {
    return signInErrorRedirect(request.url, "google_token_exchange_failed");
  }

  const profileResponse = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  const profile = (await profileResponse.json().catch(() => ({}))) as GoogleUserInfo;
  if (
    !profileResponse.ok ||
    !profile.sub ||
    !profile.email ||
    !isEmailVerified(profile.email_verified)
  ) {
    return signInErrorRedirect(request.url, "google_profile_invalid");
  }

  const email = profile.email.trim().toLowerCase();
  const providerAccountId = profile.sub;
  const displayName = profile.name?.trim().slice(0, 80) || null;

  const user = await prisma.$transaction(async (tx) => {
    const linkedAccount = await tx.authAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: GOOGLE_OAUTH_PROVIDER,
          providerAccountId,
        },
      },
      include: { user: true },
    });

    if (linkedAccount) {
      if (linkedAccount.user.name !== displayName && displayName) {
        await tx.user.update({
          where: { id: linkedAccount.user.id },
          data: { name: displayName },
        });
      }
      return linkedAccount.user;
    }

    const existingUser = await tx.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      await tx.authAccount.create({
        data: {
          userId: existingUser.id,
          provider: GOOGLE_OAUTH_PROVIDER,
          providerAccountId,
        },
      });

      if (existingUser.name !== displayName && displayName) {
        await tx.user.update({
          where: { id: existingUser.id },
          data: { name: displayName },
        });
      }

      return existingUser;
    }

    const generatedPassword = crypto.randomBytes(32).toString("base64url");
    const passwordHash = await hashPassword(generatedPassword);

    return tx.user.create({
      data: {
        email,
        name: displayName,
        passwordHash,
        role: getInitialRoleForEmail(email),
        accounts: {
          create: {
            provider: GOOGLE_OAUTH_PROVIDER,
            providerAccountId,
          },
        },
      },
    });
  });

  if (user.status === "SUSPENDED") {
    return signInErrorRedirect(request.url, "account_suspended");
  }

  await createAuthSession(user.id);

  const successRedirect = NextResponse.redirect(new URL(statePayload.nextPath, request.url));
  successRedirect.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
  return successRedirect;
}
