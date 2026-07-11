const PLACEHOLDER_VALUES = new Set([
  "change-me",
  "changeme",
  "replace-with-a-long-random-secret",
  "replace-with-a-different-long-random-secret",
  "dev-only-change-before-production",
  "secret",
  "password",
]);

const MIN_SECRET_LENGTH = 16;

type EnvIssue = {
  level: "fatal" | "warn";
  message: string;
};

function isPlaceholder(value: string) {
  return PLACEHOLDER_VALUES.has(value.toLowerCase());
}

export function collectEnvIssues(env: NodeJS.ProcessEnv = process.env): EnvIssue[] {
  const issues: EnvIssue[] = [];

  const appSecret = env.APP_SECRET?.trim() ?? "";
  if (!appSecret) {
    issues.push({
      level: "fatal",
      message: "APP_SECRET is not set. Sessions, OAuth state, and handoff tokens cannot be signed safely.",
    });
  } else if (isPlaceholder(appSecret)) {
    issues.push({
      level: "fatal",
      message: "APP_SECRET is still a placeholder value from .env.example. Generate a long random secret.",
    });
  } else if (appSecret.length < MIN_SECRET_LENGTH) {
    issues.push({
      level: "fatal",
      message: `APP_SECRET is shorter than ${MIN_SECRET_LENGTH} characters and is trivially brute-forceable.`,
    });
  }

  const dbKey = env.DB_ENCRYPTION_KEY?.trim() ?? "";
  if (!dbKey) {
    issues.push({
      level: "warn",
      message: "DB_ENCRYPTION_KEY is not set; stored provider API keys fall back to APP_SECRET for encryption. Prefer a dedicated key.",
    });
  } else if (isPlaceholder(dbKey)) {
    issues.push({
      level: "fatal",
      message: "DB_ENCRYPTION_KEY is still a placeholder value from .env.example.",
    });
  }

  const mfaCode = env.ADMIN_MFA_CODE?.trim() ?? "";
  if (mfaCode && isPlaceholder(mfaCode)) {
    issues.push({
      level: "fatal",
      message: "ADMIN_MFA_CODE is still the placeholder 'change-me'. Admin sign-in would accept a publicly known code.",
    });
  }
  if (!mfaCode) {
    issues.push({
      level: "warn",
      message: "ADMIN_MFA_CODE is not set; admin sign-in is disabled until it is configured.",
    });
  }

  const workerSecret = env.INTERNAL_WORKER_SECRET?.trim() ?? "";
  const qstashKeys =
    Boolean(env.QSTASH_CURRENT_SIGNING_KEY?.trim()) &&
    Boolean(env.QSTASH_NEXT_SIGNING_KEY?.trim());
  if (!workerSecret && !qstashKeys) {
    issues.push({
      level: "warn",
      message: "Neither QStash signing keys nor INTERNAL_WORKER_SECRET are set; internal worker endpoints will reject all requests.",
    });
  }

  return issues;
}

/**
 * Fail fast on boot when production is running with missing or
 * example-file secrets, instead of silently serving traffic in a state
 * where "encrypted" data uses a publicly known key.
 */
export function assertProductionEnv(env: NodeJS.ProcessEnv = process.env) {
  const issues = collectEnvIssues(env);
  const isProduction = env.NODE_ENV === "production";

  for (const issue of issues) {
    if (issue.level === "warn" || !isProduction) {
      console.warn(`[env-guard] ${issue.level.toUpperCase()}: ${issue.message}`);
    }
  }

  if (!isProduction) {
    return;
  }

  const fatal = issues.filter((issue) => issue.level === "fatal");
  if (fatal.length) {
    const detail = fatal.map((issue) => `- ${issue.message}`).join("\n");
    throw new Error(`[env-guard] Refusing to start with unsafe secrets:\n${detail}`);
  }
}
