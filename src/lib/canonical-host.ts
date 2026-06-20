import {
  APP_CANONICAL_URL,
  KNOWN_VERCEL_ALIASES,
  LEGACY_APP_DOMAIN,
} from "./brand.ts";

const DEFAULT_CANONICAL_APP_URL = APP_CANONICAL_URL;
const EXCLUDED_PREFIXES = ["/_next", "/api", "/.well-known/workflow"];
const EXCLUDED_PATHS = ["/favicon.ico"];

type CanonicalHostInput = {
  env?: Record<string, string | undefined>;
  hostname: string;
  pathname: string;
  method?: string;
};

export function resolveCanonicalAppUrl(
  env: Record<string, string | undefined> = process.env,
) {
  if (env.VERCEL_ENV !== "production") {
    return null;
  }

  const configured =
    env.CANONICAL_APP_URL?.trim() ||
    DEFAULT_CANONICAL_APP_URL;

  if (!configured) {
    return null;
  }

  try {
    return new URL(configured);
  } catch {
    return null;
  }
}

function isExcludedPath(pathname: string) {
  return (
    EXCLUDED_PATHS.includes(pathname) ||
    EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function isRedirectableHost(hostname: string, canonicalHostname: string) {
  return (
    !hostname.startsWith("admin.") &&
    (hostname === `www.${canonicalHostname}` ||
    hostname === LEGACY_APP_DOMAIN ||
    KNOWN_VERCEL_ALIASES.includes(hostname as (typeof KNOWN_VERCEL_ALIASES)[number]) ||
    hostname.endsWith(".vercel.app"))
  );
}

export function getCanonicalHostRedirectUrl(
  requestUrl: string,
  env: Record<string, string | undefined> = process.env,
) {
  const redirectUrl = new URL(requestUrl);
  const hostname = redirectUrl.hostname.trim().toLowerCase();
  const canonicalUrl =
    resolveCanonicalAppUrl(env) ||
    (KNOWN_VERCEL_ALIASES.includes(hostname as (typeof KNOWN_VERCEL_ALIASES)[number])
      ? new URL(DEFAULT_CANONICAL_APP_URL)
      : null);

  if (!canonicalUrl) {
    return null;
  }

  const canonicalHostname = canonicalUrl.hostname.trim().toLowerCase();

  if (!hostname || hostname === canonicalHostname) {
    return null;
  }

  if (!isRedirectableHost(hostname, canonicalHostname)) {
    return null;
  }

  redirectUrl.protocol = canonicalUrl.protocol;
  redirectUrl.host = canonicalUrl.host;
  return redirectUrl;
}

export function shouldRedirectToCanonicalHost(input: CanonicalHostInput) {
  const method = (input.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return false;
  }

  if (isExcludedPath(input.pathname)) {
    return false;
  }

  const probeUrl = new URL(`https://${input.hostname}${input.pathname}`);
  return Boolean(getCanonicalHostRedirectUrl(probeUrl.toString(), input.env));
}

export function buildCanonicalRedirectUrl(
  requestUrl: string,
  env: Record<string, string | undefined> = process.env,
) {
  return getCanonicalHostRedirectUrl(requestUrl, env);
}
