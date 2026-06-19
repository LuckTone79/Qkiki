import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const isProduction =
  process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
const dryRun = process.argv.includes("--dry-run");

const requiredColumns = [
  ["WorkbenchSession", "workflowControlJson"],
  ["WorkbenchSession", "workflowTemplateStepsJson"],
  ["ExecutionRun", "stepControlJson"],
  ["Result", "executionRunId"],
  ["Result", "executionOrder"],
];

const requiredTables = ["ExecutionRunStep"];

const requiredIndexes = [
  ["Result", "Result_executionRunId_idx"],
  ["Result", "Result_executionRunId_executionOrder_key"],
  ["ExecutionRunStep", "ExecutionRunStep_stepKey_key"],
  ["ExecutionRunStep", "ExecutionRunStep_resultId_key"],
  ["ExecutionRunStep", "ExecutionRunStep_executionRunId_status_idx"],
  ["ExecutionRunStep", "ExecutionRunStep_sessionId_executionRunId_idx"],
  ["ExecutionRunStep", "ExecutionRunStep_status_nextAttemptAt_idx"],
  ["ExecutionRunStep", "ExecutionRunStep_status_lockExpiresAt_idx"],
  ["ExecutionRunStep", "ExecutionRunStep_executionRunId_orderIndex_key"],
];

function describeChecks() {
  return {
    columns: requiredColumns.map(([tableName, columnName]) => `${tableName}.${columnName}`),
    tables: requiredTables,
    indexes: requiredIndexes.map(([tableName, indexName]) => `${tableName}.${indexName}`),
  };
}

async function existsByQuery(query, ...values) {
  const rows = await prisma.$queryRawUnsafe(query, ...values);
  return rows[0]?.exists === true;
}

async function hasColumn(tableName, columnName) {
  return existsByQuery(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = $1
          AND column_name = $2
      ) AS "exists"
    `,
    tableName,
    columnName,
  );
}

async function hasTable(tableName) {
  return existsByQuery(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = $1
      ) AS "exists"
    `,
    tableName,
  );
}

async function hasIndex(tableName, indexName) {
  return existsByQuery(
    `
      SELECT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = current_schema()
          AND tablename = $1
          AND indexname = $2
      ) AS "exists"
    `,
    tableName,
    indexName,
  );
}

if (dryRun) {
  console.log("[schema] workbench run schema assertion dry-run");
  console.log(JSON.stringify(describeChecks(), null, 2));
  await prisma.$disconnect();
  process.exit(0);
}

if (!hasDatabaseUrl) {
  await prisma.$disconnect();
  if (isProduction) {
    console.error("[schema] DATABASE_URL is required for production schema assertion.");
    process.exit(1);
  }

  console.warn("[schema] Skipping workbench schema assertion without DATABASE_URL.");
  process.exit(0);
}

const missing = [];

try {
  for (const [tableName, columnName] of requiredColumns) {
    if (!(await hasColumn(tableName, columnName))) {
      missing.push(`${tableName}.${columnName}`);
    }
  }

  for (const tableName of requiredTables) {
    if (!(await hasTable(tableName))) {
      missing.push(`${tableName} table`);
    }
  }

  for (const [tableName, indexName] of requiredIndexes) {
    if (!(await hasIndex(tableName, indexName))) {
      missing.push(`${tableName}.${indexName}`);
    }
  }

  if (missing.length > 0) {
    for (const item of missing) {
      console.error(`[schema] missing ${item}`);
    }
    process.exitCode = 1;
  } else {
    console.log("[schema] Workbench run schema assertion passed.");
  }
} finally {
  await prisma.$disconnect();
}
