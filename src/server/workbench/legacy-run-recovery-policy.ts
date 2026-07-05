const DEFAULT_STALE_RUN_SECONDS = 1800;

type RecoveryEnvironment = Readonly<Record<string, string | undefined>>;

export function getLegacyRunStaleSeconds(
  environment: RecoveryEnvironment = process.env,
) {
  const raw = environment.WORKBENCH_STALE_RUN_SECONDS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 300
    ? parsed
    : DEFAULT_STALE_RUN_SECONDS;
}

export function shouldRecoverLegacyRun(
  run: {
    runnerVersion: string;
    status: string;
    updatedAt: Date;
  },
  now = new Date(),
  environment: RecoveryEnvironment = process.env,
) {
  if (
    run.runnerVersion === "v2" ||
    !["queued", "running", "canceled"].includes(run.status)
  ) {
    return false;
  }

  const staleBefore =
    now.getTime() - getLegacyRunStaleSeconds(environment) * 1000;
  return run.updatedAt.getTime() < staleBefore;
}
