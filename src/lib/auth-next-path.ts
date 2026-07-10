const DEFAULT_NEXT_PATH = "/app/workbench";
const ALLOWED_EXACT_PATHS = ["/reset-password"];

/** Only allow same-origin redirects into the app after auth completes. */
export function sanitizeNextPath(candidate: string | null | undefined) {
  if (!candidate) {
    return DEFAULT_NEXT_PATH;
  }
  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return DEFAULT_NEXT_PATH;
  }
  if (candidate.startsWith("/app") || ALLOWED_EXACT_PATHS.includes(candidate)) {
    return candidate;
  }
  return DEFAULT_NEXT_PATH;
}
