import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCanonicalRedirectUrl,
  getCanonicalHostRedirectUrl,
  resolveCanonicalAppUrl,
  shouldRedirectToCanonicalHost,
} from "./canonical-host.ts";

test("resolveCanonicalAppUrl defaults to the wideget production host", () => {
  const resolved = resolveCanonicalAppUrl({ VERCEL_ENV: "production" });

  assert.equal(resolved?.toString(), "https://yapp.wideget.net/");
});

test("shouldRedirectToCanonicalHost redirects vercel production hosts for browser pages", () => {
  const shouldRedirect = shouldRedirectToCanonicalHost({
    env: { VERCEL_ENV: "production" },
    hostname: "qkiki.vercel.app",
    pathname: "/app/workbench",
    method: "GET",
  });

  assert.equal(shouldRedirect, true);
});

test("shouldRedirectToCanonicalHost still redirects the qkiki production alias when proxy env is missing", () => {
  const shouldRedirect = shouldRedirectToCanonicalHost({
    env: {},
    hostname: "qkiki.vercel.app",
    pathname: "/sign-in",
    method: "GET",
  });

  assert.equal(shouldRedirect, true);
});

test("resolveCanonicalAppUrl upgrades a stale legacy canonical env to the Yapp host", () => {
  const resolved = resolveCanonicalAppUrl({
    VERCEL_ENV: "production",
    CANONICAL_APP_URL: "https://qkiki.wideget.net",
  });

  assert.equal(resolved?.toString(), "https://yapp.wideget.net/");
});

test("getCanonicalHostRedirectUrl forwards the retired qkiki.wideget.net domain to Yapp", () => {
  const redirectUrl = getCanonicalHostRedirectUrl(
    "https://qkiki.wideget.net/app/workbench",
    { VERCEL_ENV: "production" },
  );

  assert.equal(
    redirectUrl?.toString(),
    "https://yapp.wideget.net/app/workbench",
  );
});

test("shouldRedirectToCanonicalHost keeps the canonical wideget host in place", () => {
  const shouldRedirect = shouldRedirectToCanonicalHost({
    env: { VERCEL_ENV: "production" },
    hostname: "yapp.wideget.net",
    pathname: "/app/workbench",
    method: "GET",
  });

  assert.equal(shouldRedirect, false);
});

test("shouldRedirectToCanonicalHost does not redirect internal worker routes", () => {
  const shouldRedirect = shouldRedirectToCanonicalHost({
    env: { VERCEL_ENV: "production" },
    hostname: "qkiki.vercel.app",
    pathname: "/api/internal/workbench/watchdog",
    method: "GET",
  });

  assert.equal(shouldRedirect, false);
});

test("shouldRedirectToCanonicalHost does not redirect generic API routes", () => {
  const shouldRedirect = shouldRedirectToCanonicalHost({
    env: { VERCEL_ENV: "production" },
    hostname: "qkiki.vercel.app",
    pathname: "/api/auth/health",
    method: "GET",
  });

  assert.equal(shouldRedirect, false);
});

test("shouldRedirectToCanonicalHost does not redirect non-idempotent browser requests", () => {
  const shouldRedirect = shouldRedirectToCanonicalHost({
    env: { VERCEL_ENV: "production" },
    hostname: "qkiki.vercel.app",
    pathname: "/api/auth/sign-in",
    method: "POST",
  });

  assert.equal(shouldRedirect, false);
});

test("shouldRedirectToCanonicalHost does not redirect admin subdomains into the user host", () => {
  const shouldRedirect = shouldRedirectToCanonicalHost({
    env: { VERCEL_ENV: "production" },
    hostname: "admin.qkiki.vercel.app",
    pathname: "/",
    method: "GET",
  });

  assert.equal(shouldRedirect, false);
});

test("resolveCanonicalAppUrl stays disabled outside production even when configured", () => {
  const resolved = resolveCanonicalAppUrl({
    VERCEL_ENV: "preview",
    CANONICAL_APP_URL: "https://yapp.wideget.net",
  });

  assert.equal(resolved, null);
});

test("getCanonicalHostRedirectUrl can still canonicalize stale auth POST origins", () => {
  const redirectUrl = getCanonicalHostRedirectUrl(
    "https://qkiki.vercel.app/api/auth/sign-in",
    { VERCEL_ENV: "production" },
  );

  assert.equal(
    redirectUrl?.toString(),
    "https://yapp.wideget.net/api/auth/sign-in",
  );
});

test("buildCanonicalRedirectUrl preserves path and query when canonicalizing", () => {
  const redirectUrl = buildCanonicalRedirectUrl(
    "https://qkiki.vercel.app/sign-in?next=%2Fapp%2Fworkbench",
    { VERCEL_ENV: "production" },
  );

  assert.equal(
    redirectUrl?.toString(),
    "https://yapp.wideget.net/sign-in?next=%2Fapp%2Fworkbench",
  );
});
