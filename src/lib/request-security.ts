const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const SERVER_TO_SERVER_PREFIXES = [
  "/api/internal/",
  "/.well-known/workflow/",
];

function normalizedOrigin(value: string | null) {
  if (!value || value === "null") {
    return null;
  }
  try {
    const url = new URL(value);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function isTrustedMutationRequest(request: Request) {
  if (SAFE_METHODS.has(request.method.toUpperCase())) {
    return true;
  }

  const requestUrl = new URL(request.url);
  if (SERVER_TO_SERVER_PREFIXES.some((prefix) => requestUrl.pathname.startsWith(prefix))) {
    return true;
  }

  const origin = normalizedOrigin(request.headers.get("origin"));
  if (!origin) {
    return false;
  }

  const expectedOrigin = requestUrl.origin;
  if (origin === expectedOrigin) {
    return true;
  }

  return false;
}
