import "server-only";

import { prisma } from "@/lib/prisma";

type ColumnSpec = {
  cacheKey: string;
  tableName: string;
  columnName: string;
  ensureStatements: string[];
  warnLabel: string;
};

const ensureColumnPromiseCache = new Map<string, Promise<boolean>>();

async function detectColumn(input: {
  tableName: string;
  columnName: string;
}) {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = ${input.tableName}
        AND column_name = ${input.columnName}
    ) AS "exists"
  `;

  return rows[0]?.exists === true;
}

async function ensureColumnInternal(spec: ColumnSpec) {
  const existsBefore = await detectColumn(spec);
  if (existsBefore) {
    return true;
  }

  try {
    for (const statement of spec.ensureStatements) {
      await prisma.$executeRawUnsafe(statement);
    }
  } catch (error) {
    console.warn(spec.warnLabel, error);
  }

  return detectColumn(spec);
}

function ensureColumn(spec: ColumnSpec) {
  const cached = ensureColumnPromiseCache.get(spec.cacheKey);
  if (cached) {
    return cached;
  }

  const promise = ensureColumnInternal(spec).catch((error) => {
    ensureColumnPromiseCache.delete(spec.cacheKey);
    throw error;
  });
  ensureColumnPromiseCache.set(spec.cacheKey, promise);
  return promise;
}

export function ensureExecutionRunStepControlJsonColumn() {
  return ensureColumn({
    cacheKey: "ExecutionRun.stepControlJson",
    tableName: "ExecutionRun",
    columnName: "stepControlJson",
    ensureStatements: [
      `
        ALTER TABLE "ExecutionRun"
        ADD COLUMN IF NOT EXISTS "stepControlJson" TEXT
      `,
    ],
    warnLabel:
      "[workbench-run-schema] could not auto-add ExecutionRun.stepControlJson column",
  });
}

export function ensureResultExecutionRunIdColumn() {
  return ensureColumn({
    cacheKey: "Result.executionRunId",
    tableName: "Result",
    columnName: "executionRunId",
    ensureStatements: [
      `
        ALTER TABLE "Result"
        ADD COLUMN IF NOT EXISTS "executionRunId" TEXT
      `,
      `
        CREATE INDEX IF NOT EXISTS "Result_executionRunId_idx"
        ON "Result"("executionRunId")
      `,
    ],
    warnLabel:
      "[workbench-run-schema] could not auto-add Result.executionRunId column",
  });
}

export async function ensureWorkbenchRunSchema() {
  const [supportsStepControl, supportsRunScopedResults] = await Promise.all([
    ensureExecutionRunStepControlJsonColumn(),
    ensureResultExecutionRunIdColumn(),
  ]);

  return {
    supportsStepControl,
    supportsRunScopedResults,
  };
}
