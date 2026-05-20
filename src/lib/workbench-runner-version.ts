import crypto from "node:crypto";

function stableHashToPercent(input: string) {
  const hash = crypto.createHash("sha256").update(input).digest("hex");
  const n = Number.parseInt(hash.slice(0, 8), 16);
  return n % 100;
}

export type WorkbenchRunnerVersion = "v1" | "v2";

export function selectWorkbenchRunnerVersion(userId: string): WorkbenchRunnerVersion {
  const mode = process.env.WORKBENCH_RUNNER_VERSION || "v1";
  const allowlist = (process.env.RUNNER_V2_USER_ALLOWLIST || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (allowlist.includes(userId)) {
    return "v2";
  }

  if (mode === "v1") {
    return "v1";
  }

  if (mode === "v2") {
    return "v2";
  }

  const percent = Number(process.env.RUNNER_V2_USER_COHORT_PERCENT || 0);
  return stableHashToPercent(userId) < percent ? "v2" : "v1";
}
