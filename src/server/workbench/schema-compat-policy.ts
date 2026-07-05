type SchemaRepairEnvironment = Readonly<Record<string, string | undefined>>;

export function isLegacyWorkbenchSchemaRepairEnabled(
  environment: SchemaRepairEnvironment = process.env,
) {
  return environment.LEGACY_WORKBENCH_SCHEMA_REPAIR?.trim() === "1";
}

export function getAssuredWorkbenchSchemaCapabilities() {
  return {
    supportsStepControl: true,
    supportsRunScopedResults: true,
    supportsRunExecutionOrder: true,
  } as const;
}
