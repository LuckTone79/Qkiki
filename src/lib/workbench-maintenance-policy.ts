type EnvLike = Record<string, string | undefined>;

function isFlagEnabled(value: string | undefined) {
  return value?.trim() === "1";
}

export const WORKBENCH_RUN_SCHEMA_CAPABILITIES = {
  supportsStepControl: true,
  supportsRunScopedResults: true,
  supportsRunExecutionOrder: true,
} as const;

export function shouldRunLegacyWorkbenchSchemaRepair(
  env: EnvLike = process.env,
) {
  return isFlagEnabled(env.LEGACY_WORKBENCH_SCHEMA_REPAIR);
}

export function shouldRunRequestStaleCleanup(env: EnvLike = process.env) {
  return isFlagEnabled(env.LEGACY_WORKBENCH_REQUEST_STALE_CLEANUP);
}
