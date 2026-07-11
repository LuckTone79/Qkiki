const INTERNAL_ORIGIN = "https://internal.invalid";
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const ENCODED_PATH_SEPARATOR = /%(?:2f|5c|00)/i;

type SafeInternalPathOptions = {
  fallback: string;
  allowedPrefixes?: readonly string[];
  allowedExactPaths?: readonly string[];
};

function isAllowedPathname(pathname: string, options: SafeInternalPathOptions) {
  if (options.allowedExactPaths?.includes(pathname)) {
    return true;
  }

  return Boolean(
    options.allowedPrefixes?.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    ),
  );
}

/**
 * Parse redirects against a fixed origin instead of relying on string-prefix
 * checks. Backslashes, controls and encoded separators are rejected before URL
 * normalization so browser-specific parsing cannot turn them into a new host.
 */
export function sanitizeInternalPath(
  candidate: string | null | undefined,
  options: SafeInternalPathOptions,
) {
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    CONTROL_CHARACTERS.test(candidate) ||
    ENCODED_PATH_SEPARATOR.test(candidate)
  ) {
    return options.fallback;
  }

  try {
    const parsed = new URL(candidate, INTERNAL_ORIGIN);
    if (
      parsed.origin !== INTERNAL_ORIGIN ||
      parsed.username ||
      parsed.password ||
      !isAllowedPathname(parsed.pathname, options)
    ) {
      return options.fallback;
    }

    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return options.fallback;
  }
}
