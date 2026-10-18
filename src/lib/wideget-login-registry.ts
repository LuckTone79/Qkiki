export type YappPrimaryLoginProvider = "email_password" | "google" | "kakao";
export type YappSocialLoginProvider = Exclude<YappPrimaryLoginProvider, "email_password">;

type ProviderStatus =
  | "disabled"
  | "planned"
  | "console_pending"
  | "configured"
  | "verified_sandbox"
  | "verified_production"
  | "degraded";

type YappProvider = {
  id: string;
  purpose: "primary_login" | "otp_delivery";
  status: ProviderStatus;
  platforms: readonly ["web"];
};

/**
 * App-owned projection of wideget.auth.json.
 *
 * The config records console/configuration readiness. Real browser callback,
 * mail delivery, and provider E2E evidence remain separate release gates.
 * Sign-in and sign-up consume this one registry so they cannot drift apart.
 */
export const YAPP_PROVIDER_REGISTRY: readonly YappProvider[] = [
  {
    id: "email_password",
    purpose: "primary_login",
    status: "configured",
    platforms: ["web"],
  },
  {
    id: "google",
    purpose: "primary_login",
    status: "configured",
    platforms: ["web"],
  },
  {
    id: "kakao",
    purpose: "primary_login",
    status: "configured",
    platforms: ["web"],
  },
  {
    id: "facebook",
    purpose: "primary_login",
    status: "planned",
    platforms: ["web"],
  },
  {
    id: "whatsapp_otp",
    purpose: "otp_delivery",
    status: "planned",
    platforms: ["web"],
  },
  {
    id: "apple",
    purpose: "primary_login",
    status: "planned",
    platforms: ["web"],
  },
] as const;

const CONFIGURED_STATUSES: readonly ProviderStatus[] = [
  "configured",
  "verified_sandbox",
  "verified_production",
];

function isConfiguredStatus(status: ProviderStatus) {
  return CONFIGURED_STATUSES.includes(status);
}

export function getEnabledWebPrimaryLoginProviders() {
  return YAPP_PROVIDER_REGISTRY.filter(
    (provider): provider is YappProvider & { id: YappPrimaryLoginProvider } =>
      provider.purpose === "primary_login" &&
      isConfiguredStatus(provider.status) &&
      provider.platforms.includes("web") &&
      (provider.id === "email_password" ||
        provider.id === "google" ||
        provider.id === "kakao"),
  );
}

export function isEnabledWebSocialLoginProvider(
  value: string,
): value is YappSocialLoginProvider {
  return getEnabledWebPrimaryLoginProviders().some(
    (provider) => provider.id === value && provider.id !== "email_password",
  );
}

export function getProviderStatus(providerId: string) {
  return YAPP_PROVIDER_REGISTRY.find((provider) => provider.id === providerId)?.status ?? "disabled";
}
