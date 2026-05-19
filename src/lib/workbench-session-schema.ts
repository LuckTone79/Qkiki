import "server-only";

import { prisma } from "@/lib/prisma";

let workflowControlColumnPromise: Promise<boolean> | null = null;
let workflowTemplateStepsColumnPromise: Promise<boolean> | null = null;

async function detectWorkbenchSessionColumn(columnName: string) {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'WorkbenchSession'
        AND column_name = ${columnName}
    ) AS "exists"
  `;

  return rows[0]?.exists === true;
}

async function ensureWorkflowControlColumnInternal() {
  const existsBefore = await detectWorkbenchSessionColumn("workflowControlJson");
  if (existsBefore) {
    return true;
  }

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "WorkbenchSession"
      ADD COLUMN IF NOT EXISTS "workflowControlJson" TEXT
    `);
  } catch (error) {
    console.warn(
      "[workbench-session-schema] could not auto-add workflowControlJson column",
      error,
    );
  }

  return detectWorkbenchSessionColumn("workflowControlJson");
}

async function ensureWorkflowTemplateStepsColumnInternal() {
  const existsBefore = await detectWorkbenchSessionColumn(
    "workflowTemplateStepsJson",
  );
  if (existsBefore) {
    return true;
  }

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "WorkbenchSession"
      ADD COLUMN IF NOT EXISTS "workflowTemplateStepsJson" TEXT
    `);
  } catch (error) {
    console.warn(
      "[workbench-session-schema] could not auto-add workflowTemplateStepsJson column",
      error,
    );
  }

  return detectWorkbenchSessionColumn("workflowTemplateStepsJson");
}

export async function ensureWorkflowControlJsonColumn() {
  if (!workflowControlColumnPromise) {
    workflowControlColumnPromise = ensureWorkflowControlColumnInternal().catch((error) => {
      workflowControlColumnPromise = null;
      throw error;
    });
  }

  return workflowControlColumnPromise;
}

export async function ensureWorkflowTemplateStepsJsonColumn() {
  if (!workflowTemplateStepsColumnPromise) {
    workflowTemplateStepsColumnPromise =
      ensureWorkflowTemplateStepsColumnInternal().catch((error) => {
        workflowTemplateStepsColumnPromise = null;
        throw error;
      });
  }

  return workflowTemplateStepsColumnPromise;
}
