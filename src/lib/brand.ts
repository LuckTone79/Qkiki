export const APP_NAME = "Yapp";
export const APP_NAME_LOWER = "yapp";
export const APP_NAME_UPPER = "YAPP";
export const APP_DOMAIN = "yapp.wideget.net";
export const APP_ORGANIZATION = "Wideget";
export const APP_GUIDE_NAME = `${APP_NAME} Guidebook`;
export const APP_WORKBENCH_NAME = `${APP_NAME} Workbench`;
export const APP_ORCHESTRATION_NAME = `${APP_NAME} Orchestration Workbench`;
export const APP_CANONICAL_URL = `https://${APP_DOMAIN}`;
export const PRIMARY_VERCEL_ALIAS = "yapp.vercel.app";

export const LEGACY_APP_NAMES = ["Qkiki", "qkiki", "QKIKI"] as const;
export const LEGACY_APP_DOMAIN = "qkiki.wideget.net";
export const LEGACY_CANONICAL_URL = `https://${LEGACY_APP_DOMAIN}`;
export const LEGACY_VERCEL_ALIASES = ["qkiki.vercel.app"] as const;
export const KNOWN_VERCEL_ALIASES = [
  PRIMARY_VERCEL_ALIAS,
  ...LEGACY_VERCEL_ALIASES,
] as const;

export const PRIMARY_STORAGE_KEYS = {
  language: "yapp-language",
  resultLayout: "yapp-result-layout-v2",
  sidebarCollapsed: "yapp-sidebar-collapsed",
  draft: "yapp-draft",
  sessionPrefix: "yapp-sc-",
  usage: "yapp-usage-cache",
} as const;

export const LEGACY_STORAGE_KEYS = {
  language: ["qkiki-language"],
  resultLayout: ["qkiki-result-layout-v2"],
  sidebarCollapsed: ["qkiki-sidebar-collapsed"],
  draft: ["qkiki-draft"],
  sessionPrefix: ["qkiki-sc-"],
  usage: ["qkiki-usage-cache"],
} as const;
