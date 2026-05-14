const EMBEDDED_BROWSER_PATTERNS = [
  /KAKAOTALK/i,
  /FBAN/i,
  /FBAV/i,
  /Instagram/i,
  /Line\//i,
  /MicroMessenger/i,
  /NAVER/i,
  /DaumApps/i,
  /wv\)/i,
  /; wv/i,
  /WebView/i,
  /Twitter/i,
  /Snapchat/i,
];

export function isLikelyEmbeddedBrowser(userAgent: string | null | undefined) {
  const ua = userAgent?.trim() || "";
  if (!ua) {
    return false;
  }

  return EMBEDDED_BROWSER_PATTERNS.some((pattern) => pattern.test(ua));
}

export function sanitizeOpenInBrowserTarget(
  candidate: string | null | undefined,
) {
  if (!candidate) {
    return "/sign-in";
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return "/sign-in";
  }

  if (!candidate.startsWith("/api/auth/google/start")) {
    return "/sign-in";
  }

  return candidate;
}

export function buildOpenInBrowserPath(targetPath: string) {
  const safeTarget = sanitizeOpenInBrowserTarget(targetPath);
  return `/open-in-browser?target=${encodeURIComponent(safeTarget)}`;
}

export function buildAndroidIntentUrl(absoluteUrl: string) {
  try {
    const url = new URL(absoluteUrl);
    const query = url.search || "";
    const fragment = url.hash || "";
    return `intent://${url.host}${url.pathname}${query}${fragment}#Intent;scheme=${url.protocol.replace(":", "")};package=com.android.chrome;end`;
  } catch {
    return absoluteUrl;
  }
}
