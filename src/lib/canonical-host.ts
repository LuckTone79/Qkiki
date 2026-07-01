// Kept in sync with src/lib/brand.ts (APP_DOMAIN / LEGACY_APP_DOMAIN). These are
// duplicated as plain strings so this edge-safe module has no runtime imports.
const APP_DOMAIN = "yapp.wideget.net";
const LEGACY_APP_DOMAIN = "qkiki.wideget.net";
const DEFAULT_CANONICAL_APP_URL = `https://${APP_DOMAIN}`;
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
    const url = new URL(configured);
    // A stale environment may still point CANONICAL_APP_URL at the legacy
    // domain. Transparently upgrade it to the current brand host so Yapp stays
    // the canonical destination even before the env var is updated.
    if (url.hostname.trim().toLowerCase() === LEGACY_APP_DOMAIN) {
      url.hostname = APP_DOMAIN;
    }
    return url;
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
  if (hostname.startsWith("admin.")) {
    return false;
  }

  return (
    hostname === `www.${canonicalHostname}` ||
    // Forward the retired brand domain to the current canonical host.
    hostname === LEGACY_APP_DOMAIN ||
    hostname === `www.${LEGACY_APP_DOMAIN}` ||
    hostname === "qkiki.vercel.app" ||
    hostname.endsWith(".vercel.app")
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
    (hostname === "qkiki.vercel.app" ? new URL(DEFAULT_CANONICAL_APP_URL) : null);

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
