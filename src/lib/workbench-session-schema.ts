import "server-only";

import { prisma } from "@/lib/prisma";

let workflowControlColumnPromise: Promise<boolean> | null = null;

async function detectWorkflowControlColumn() {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'WorkbenchSession'
        AND column_name = 'workflowControlJson'
    ) AS "exists"
  `;

  return rows[0]?.exists === true;
}

async function ensureColumnInternal() {
  const existsBefore = await detectWorkflowControlColumn();
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

  return detectWorkflowControlColumn();
}

export async function ensureWorkflowControlJsonColumn() {
  if (!workflowControlColumnPromise) {
    workflowControlColumnPromise = ensureColumnInternal().catch((error) => {
      workflowControlColumnPromise = null;
      throw error;
    });
  }

  return workflowControlColumnPromise;
}
