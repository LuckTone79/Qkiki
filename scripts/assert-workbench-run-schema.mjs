import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const requiredColumns = [
  ["ExecutionRun", "stepControlJson"],
  ["Result", "executionRunId"],
  ["Result", "executionOrder"],
];
const requiredTables = ["ExecutionRunStep"];
const requiredIndexes = [
  ["Result", "Result_executionRunId_idx"],
  ["Result", "Result_executionRunId_executionOrder_key"],
  ["ExecutionRunStep", "ExecutionRunStep_executionRunId_status_idx"],
  ["ExecutionRunStep", "ExecutionRunStep_sessionId_executionRunId_idx"],
  ["ExecutionRunStep", "ExecutionRunStep_status_nextAttemptAt_idx"],
  ["ExecutionRunStep", "ExecutionRunStep_status_lockExpiresAt_idx"],
];

async function queryExists(sql, ...params) {
  const rows = await prisma.$queryRawUnsafe(sql, ...params);
  return rows[0]?.exists === true;
}

const missing = [];

try {
  for (const [tableName, columnName] of requiredColumns) {
    const exists = await queryExists(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = $1
          AND column_name = $2
      ) AS "exists"`,
      tableName,
      columnName,
    );
    if (!exists) missing.push(`column ${tableName}.${columnName}`);
  }

  for (const tableName of requiredTables) {
    const exists = await queryExists(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = $1
      ) AS "exists"`,
      tableName,
    );
    if (!exists) missing.push(`table ${tableName}`);
  }

  for (const [tableName, indexName] of requiredIndexes) {
    const exists = await queryExists(
      `SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = current_schema()
          AND tablename = $1
          AND indexname = $2
      ) AS "exists"`,
      tableName,
      indexName,
    );
    if (!exists) missing.push(`index ${tableName}.${indexName}`);
  }

  if (missing.length > 0) {
    console.error("[schema] Required workbench schema is incomplete:");
    for (const item of missing) console.error(`- ${item}`);
    process.exitCode = 1;
  } else {
    console.log("[schema] Required workbench schema is present.");
  }
} finally {
  await prisma.$disconnect();
}
