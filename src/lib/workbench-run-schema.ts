import "server-only";

import { prisma } from "@/lib/prisma";

// Deprecated runtime schema repair helper.
// Production schema management must use prisma migrate deploy before serving traffic.
// Keep this temporarily for legacy expand-only columns while older deployments drain out.
// Do not add ExecutionRunStep or other new V2 tables to this runtime repair path.

type ColumnSpec = {
  cacheKey: string;
  tableName: string;
  columnName: string;
  ensureStatements: string[];
  warnLabel: string;
};

const ensureColumnPromiseCache = new Map<string, Promise<boolean>>();
const ensureIndexPromiseCache = new Map<string, Promise<boolean>>();

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

async function detectIndex(input: {
  tableName: string;
  indexName: string;
}) {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename = ${input.tableName}
        AND indexname = ${input.indexName}
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

async function ensureIndexInternal(input: {
  cacheKey: string;
  tableName: string;
  indexName: string;
  ensureStatements: string[];
  warnLabel: string;
}) {
  if (await detectIndex(input)) {
    return true;
  }

  try {
    for (const statement of input.ensureStatements) {
      await prisma.$executeRawUnsafe(statement);
    }
  } catch (error) {
    console.warn(input.warnLabel, error);
  }

  return detectIndex(input);
}

function ensureIndex(input: {
  cacheKey: string;
  tableName: string;
  indexName: string;
  ensureStatements: string[];
  warnLabel: string;
}) {
  const cached = ensureIndexPromiseCache.get(input.cacheKey);
  if (cached) {
    return cached;
  }

  const promise = ensureIndexInternal(input).catch((error) => {
    ensureIndexPromiseCache.delete(input.cacheKey);
    throw error;
  });
  ensureIndexPromiseCache.set(input.cacheKey, promise);
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

export async function ensureResultExecutionOrderColumn() {
  const hasColumn = await ensureColumn({
    cacheKey: "Result.executionOrder",
    tableName: "Result",
    columnName: "executionOrder",
    ensureStatements: [
      `
        ALTER TABLE "Result"
        ADD COLUMN IF NOT EXISTS "executionOrder" INTEGER
      `,
    ],
    warnLabel:
      "[workbench-run-schema] could not auto-add Result.executionOrder column",
  });

  if (!hasColumn) {
    return false;
  }

  return ensureIndex({
    cacheKey: "Result.executionRunId.executionOrder.unique",
    tableName: "Result",
    indexName: "Result_executionRunId_executionOrder_key",
    ensureStatements: [
      `
        WITH ranked AS (
          SELECT
            id,
            ROW_NUMBER() OVER (
              PARTITION BY "executionRunId", "executionOrder"
              ORDER BY
                CASE "status"
                  WHEN 'completed' THEN 0
                  WHEN 'running' THEN 1
                  WHEN 'failed' THEN 2
                  WHEN 'canceled' THEN 3
                  ELSE 4
                END,
                "updatedAt" DESC,
                "createdAt" ASC
            ) AS rn
          FROM "Result"
          WHERE "executionRunId" IS NOT NULL
            AND "executionOrder" IS NOT NULL
        )
        UPDATE "Result"
        SET "executionOrder" = NULL
        WHERE id IN (
          SELECT id
          FROM ranked
          WHERE rn > 1
        )
      `,
      `
        CREATE UNIQUE INDEX IF NOT EXISTS "Result_executionRunId_executionOrder_key"
        ON "Result"("executionRunId", "executionOrder")
      `,
    ],
    warnLabel:
      "[workbench-run-schema] could not auto-add Result.executionOrder column",
  });
}

export async function ensureWorkbenchRunSchema() {
  const [supportsStepControl, supportsRunScopedResults] = await Promise.all([
    ensureExecutionRunStepControlJsonColumn(),
    ensureResultExecutionRunIdColumn(),
  ]);
  const supportsRunExecutionOrder = await ensureResultExecutionOrderColumn();

  return {
    supportsStepControl,
    supportsRunScopedResults,
    supportsRunExecutionOrder,
  };
}
