import "server-only";

import { collectEnvIssues } from "@/lib/env-validation";

export { collectEnvIssues } from "@/lib/env-validation";

export function assertProductionEnv(env: NodeJS.ProcessEnv = process.env) {
  const issues = collectEnvIssues(env);
  const isProduction = env.NODE_ENV === "production";

  for (const issue of issues) {
    if (issue.level === "warn" || !isProduction) {
      console.warn(`[env-guard] ${issue.level.toUpperCase()}: ${issue.message}`);
    }
  }

  if (!isProduction) return;
  const fatal = issues.filter((issue) => issue.level === "fatal");
  if (fatal.length) {
    throw new Error(
      `[env-guard] Refusing to start with unsafe configuration:\n${fatal
        .map((issue) => `- ${issue.message}`)
        .join("\n")}`,
    );
  }
}
