import "server-only";

import { ensureWorkbenchRunSchema } from "@/lib/workbench-run-schema";
import {
  getAssuredWorkbenchSchemaCapabilities,
  isLegacyWorkbenchSchemaRepairEnabled,
} from "@/server/workbench/schema-compat-policy";

let didWarnAboutLegacyRepair = false;

export async function getWorkbenchSchemaCapabilities() {
  if (!isLegacyWorkbenchSchemaRepairEnabled()) {
    return getAssuredWorkbenchSchemaCapabilities();
  }

  if (!didWarnAboutLegacyRepair) {
    didWarnAboutLegacyRepair = true;
    console.warn(
      "[workbench-schema] LEGACY_WORKBENCH_SCHEMA_REPAIR is enabled; disable it after the production schema is repaired.",
    );
  }

  return ensureWorkbenchRunSchema();
}
