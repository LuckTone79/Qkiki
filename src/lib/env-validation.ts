const PLACEHOLDER_VALUES = new Set([
  "change-me",
  "changeme",
  "replace-with-a-long-random-secret",
  "replace-with-a-different-long-random-secret",
  "dev-only-change-before-production",
  "secret",
  "password",
]);

export type EnvIssue = { level: "fatal" | "warn"; message: string };

function isPlaceholder(value: string) {
  return PLACEHOLDER_VALUES.has(value.toLowerCase());
}

function isWeakSecret(value: string) {
  if (value.length < 32 || new Set(value).size < 10) return true;
  for (let width = 1; width <= Math.min(8, value.length / 2); width += 1) {
    const unit = value.slice(0, width);
    if (unit.repeat(Math.ceil(value.length / width)).slice(0, value.length) === value) {
      return true;
    }
  }
  return false;
}

function base32ByteLength(value: string) {
  const normalized = value.toUpperCase().replace(/[\s=]/g, "");
  if (!normalized || /[^A-Z2-7]/.test(normalized)) return 0;
  return Math.floor((normalized.length * 5) / 8);
}

function isExactHttpsOrigin(value: string, hostname: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === hostname &&
      !url.port &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function requireStrongSecret(
  issues: EnvIssue[],
  env: NodeJS.ProcessEnv,
  name: string,
) {
  const value = env[name]?.trim() ?? "";
  if (!value || isPlaceholder(value) || isWeakSecret(value)) {
    issues.push({
      level: "fatal",
      message: `${name} must be an independent, non-placeholder secret with at least 32 characters and high diversity.`,
    });
  }
  return value;
}

export function collectEnvIssues(env: NodeJS.ProcessEnv = process.env): EnvIssue[] {
  const issues: EnvIssue[] = [];
  const appSecret = requireStrongSecret(issues, env, "APP_SECRET");
  const dbKey = requireStrongSecret(issues, env, "DB_ENCRYPTION_KEY");

  if (appSecret && dbKey && appSecret === dbKey) {
    issues.push({
      level: "fatal",
      message: "APP_SECRET and DB_ENCRYPTION_KEY must be different keys.",
    });
  }

  if (!env.DATABASE_URL?.trim()) {
    issues.push({ level: "fatal", message: "DATABASE_URL is required." });
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!supabaseUrl || !supabaseAnonKey) {
    issues.push({
      level: "fatal",
      message: "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.",
    });
  } else {
    try {
      const parsed = new URL(supabaseUrl);
      if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".supabase.co")) {
        issues.push({ level: "fatal", message: "NEXT_PUBLIC_SUPABASE_URL must be an HTTPS Supabase project URL." });
      }
    } catch {
      issues.push({ level: "fatal", message: "NEXT_PUBLIC_SUPABASE_URL is invalid." });
    }
  }

  if (env.INITIAL_ADMIN_EMAILS?.trim()) {
    issues.push({
      level: "fatal",
      message: "INITIAL_ADMIN_EMAILS is forbidden; bootstrap administrators offline.",
    });
  }
  if (env.ENABLE_PASSWORD_SIGNUP?.trim().toLowerCase() === "true") {
    issues.push({
      level: "fatal",
      message: "Password sign-up cannot be enabled before verified-email enrollment is implemented.",
    });
  }
  if (env.ADMIN_MFA_CODE?.trim()) {
    issues.push({
      level: "fatal",
      message: "ADMIN_MFA_CODE is a static credential and is forbidden. Use ADMIN_TOTP_SECRET.",
    });
  }

  const totpSecret = env.ADMIN_TOTP_SECRET?.trim() ?? "";
  if (base32ByteLength(totpSecret) < 20) {
    issues.push({
      level: "fatal",
      message: "ADMIN_TOTP_SECRET must be valid Base32 containing at least 20 random bytes.",
    });
  }

  const redisUrl = env.UPSTASH_REDIS_REST_URL?.trim();
  const redisToken = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!redisUrl || !redisToken) {
    issues.push({
      level: "fatal",
      message: "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required for distributed abuse protection.",
    });
  }

  const qstashCurrent = env.QSTASH_CURRENT_SIGNING_KEY?.trim();
  const qstashNext = env.QSTASH_NEXT_SIGNING_KEY?.trim();
  if (Boolean(qstashCurrent) !== Boolean(qstashNext)) {
    issues.push({
      level: "fatal",
      message: "QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY must be configured together.",
    });
  }
  if (!qstashCurrent && !qstashNext) {
    requireStrongSecret(issues, env, "INTERNAL_WORKER_SECRET");
  }

  const canonicalUrl = env.CANONICAL_APP_URL?.trim() ?? "";
  const appBaseUrl = env.APP_BASE_URL?.trim() ?? "";
  if (!isExactHttpsOrigin(canonicalUrl, "yapp.wideget.net")) {
    issues.push({
      level: "fatal",
      message: "CANONICAL_APP_URL must be exactly https://yapp.wideget.net.",
    });
  }
  if (!isExactHttpsOrigin(appBaseUrl, "yapp.wideget.net")) {
    issues.push({
      level: "fatal",
      message: "APP_BASE_URL must be exactly https://yapp.wideget.net.",
    });
  }

  const googleClientId = env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const googleClientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (Boolean(googleClientId) !== Boolean(googleClientSecret)) {
    issues.push({
      level: "fatal",
      message: "Google OAuth client ID and secret must be configured together.",
    });
  }
  if (googleClientId && googleClientSecret) {
    const expectedRedirect = "https://yapp.wideget.net/api/auth/google/callback";
    if (env.GOOGLE_OAUTH_REDIRECT_URI?.trim() !== expectedRedirect) {
      issues.push({
        level: "fatal",
        message: `GOOGLE_OAUTH_REDIRECT_URI must be exactly ${expectedRedirect}.`,
      });
    }
  }

  return issues;
}
