// Primary cookie names carry the Yapp brand. The legacy qkiki_* names are kept
// so sessions issued before the rebrand keep working: read paths fall back to
// the legacy cookie, and sign-out clears both.
export const SESSION_COOKIE = "yapp_session";
export const ADMIN_SESSION_COOKIE = "yapp_admin_session";
export const TRIAL_COOKIE = "yapp_trial";

export const LEGACY_SESSION_COOKIE = "qkiki_session";
export const LEGACY_ADMIN_SESSION_COOKIE = "qkiki_admin_session";
export const LEGACY_TRIAL_COOKIE = "qkiki_trial";
