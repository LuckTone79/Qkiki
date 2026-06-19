export const SESSION_COOKIE = "yapp_session";
export const LEGACY_SESSION_COOKIES = ["qkiki_session"] as const;
export const SESSION_COOKIE_CANDIDATES = [
  SESSION_COOKIE,
  ...LEGACY_SESSION_COOKIES,
] as const;

export const ADMIN_SESSION_COOKIE = "yapp_admin_session";
export const LEGACY_ADMIN_SESSION_COOKIES = ["qkiki_admin_session"] as const;
export const ADMIN_SESSION_COOKIE_CANDIDATES = [
  ADMIN_SESSION_COOKIE,
  ...LEGACY_ADMIN_SESSION_COOKIES,
] as const;

export const TRIAL_COOKIE = "yapp_trial";
export const LEGACY_TRIAL_COOKIES = ["qkiki_trial"] as const;
export const TRIAL_COOKIE_CANDIDATES = [
  TRIAL_COOKIE,
  ...LEGACY_TRIAL_COOKIES,
] as const;

type CookieValue = { value?: string } | undefined | null;
type CookieReader = {
  get(name: string): CookieValue;
  has?: (name: string) => boolean;
};
type CookieDeleter = {
  delete(name: string): unknown;
};

export function readCookieValue(
  cookieStore: CookieReader,
  candidates: readonly string[],
) {
  for (const candidate of candidates) {
    const value = cookieStore.get(candidate)?.value;
    if (value) {
      return value;
    }
  }

  return null;
}

export function hasAnyCookie(
  cookieStore: CookieReader,
  candidates: readonly string[],
) {
  if (typeof cookieStore.has === "function") {
    return candidates.some((candidate) => cookieStore.has?.(candidate));
  }

  return Boolean(readCookieValue(cookieStore, candidates));
}

export function deleteCookies(
  cookieStore: CookieDeleter,
  candidates: readonly string[],
) {
  for (const candidate of candidates) {
    cookieStore.delete(candidate);
  }
}
