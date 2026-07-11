// __Host- cookies cannot be scoped to a parent domain and therefore resist
// cookie tossing from sibling subdomains. Local HTTP development uses the
// unprefixed names because __Host- requires Secure.
const hostPrefix = process.env.NODE_ENV === "production" ? "__Host-" : "";

export const SESSION_COOKIE = `${hostPrefix}yapp_session`;
export const ADMIN_SESSION_COOKIE = `${hostPrefix}yapp_admin_session`;
export const TRIAL_COOKIE = `${hostPrefix}yapp_trial`;

export const PRE_HOST_SESSION_COOKIE = "yapp_session";
export const PRE_HOST_ADMIN_SESSION_COOKIE = "yapp_admin_session";
export const PRE_HOST_TRIAL_COOKIE = "yapp_trial";

export const LEGACY_SESSION_COOKIE = "qkiki_session";
export const LEGACY_ADMIN_SESSION_COOKIE = "qkiki_admin_session";
export const LEGACY_TRIAL_COOKIE = "qkiki_trial";

export const USER_SESSION_COOKIE_CANDIDATES = [
  SESSION_COOKIE,
  PRE_HOST_SESSION_COOKIE,
  LEGACY_SESSION_COOKIE,
] as const;

export const ADMIN_SESSION_COOKIE_CANDIDATES = [
  ADMIN_SESSION_COOKIE,
  PRE_HOST_ADMIN_SESSION_COOKIE,
  LEGACY_ADMIN_SESSION_COOKIE,
] as const;

export const TRIAL_COOKIE_CANDIDATES = [
  TRIAL_COOKIE,
  PRE_HOST_TRIAL_COOKIE,
  LEGACY_TRIAL_COOKIE,
] as const;
