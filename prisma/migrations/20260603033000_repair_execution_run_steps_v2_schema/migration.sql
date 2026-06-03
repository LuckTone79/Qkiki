-- Repair migration for production environments where the V2 migration was
-- marked as applied without executing the underlying DDL.

ALTER TABLE "ExecutionRun"
ADD COLUMN IF NOT EXISTS "branchFromOrderIndex" INTEGER,
ADD COLUMN IF NOT EXISTS "branchReason" TEXT,
ADD COLUMN IF NOT EXISTS "parentExecutionRunId" TEXT,
ADD COLUMN IF NOT EXISTS "runnerVersion" TEXT NOT NULL DEFAULT 'v1';

ALTER TABLE "ExecutionRun" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "ProviderLease" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "UsageReservation" ALTER COLUMN "updatedAt" DROP DEFAULT;

CREATE TABLE IF NOT EXISTS "ExecutionRunStep" (
    "id" TEXT NOT NULL,
    "executionRunId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "stepKey" TEXT NOT NULL,
    "attemptKey" TEXT,
    "templateStepIndex" INTEGER NOT NULL,
    "templateStepId" TEXT,
    "actionType" TEXT NOT NULL,
    "targetProvider" TEXT NOT NULL,
    "targetModel" TEXT NOT NULL,
    "sourceMode" TEXT NOT NULL,
    "sourceResultId" TEXT,
    "instructionTemplate" TEXT,
    "repeatBlockIndex" INTEGER,
    "repeatIteration" INTEGER,
    "repeatRangeStart" INTEGER,
    "repeatRangeEnd" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "queuedAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lockExpiresAt" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),
    "sourceTextSnapshot" TEXT,
    "promptSnapshot" TEXT,
    "promptHash" TEXT,
    "resultId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "errorRetryable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutionRunStep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExecutionRunStep_stepKey_key" ON "ExecutionRunStep"("stepKey");
CREATE UNIQUE INDEX IF NOT EXISTS "ExecutionRunStep_resultId_key" ON "ExecutionRunStep"("resultId");
CREATE INDEX IF NOT EXISTS "ExecutionRunStep_executionRunId_status_idx" ON "ExecutionRunStep"("executionRunId", "status");
CREATE INDEX IF NOT EXISTS "ExecutionRunStep_sessionId_executionRunId_idx" ON "ExecutionRunStep"("sessionId", "executionRunId");
CREATE INDEX IF NOT EXISTS "ExecutionRunStep_status_nextAttemptAt_idx" ON "ExecutionRunStep"("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "ExecutionRunStep_status_lockExpiresAt_idx" ON "ExecutionRunStep"("status", "lockExpiresAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ExecutionRunStep_executionRunId_orderIndex_key" ON "ExecutionRunStep"("executionRunId", "orderIndex");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ExecutionRun_parentExecutionRunId_fkey'
  ) THEN
    ALTER TABLE "ExecutionRun"
    ADD CONSTRAINT "ExecutionRun_parentExecutionRunId_fkey"
    FOREIGN KEY ("parentExecutionRunId") REFERENCES "ExecutionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ExecutionRunStep_executionRunId_fkey'
  ) THEN
    ALTER TABLE "ExecutionRunStep"
    ADD CONSTRAINT "ExecutionRunStep_executionRunId_fkey"
    FOREIGN KEY ("executionRunId") REFERENCES "ExecutionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ExecutionRunStep_sessionId_fkey'
  ) THEN
    ALTER TABLE "ExecutionRunStep"
    ADD CONSTRAINT "ExecutionRunStep_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "WorkbenchSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ExecutionRunStep_resultId_fkey'
  ) THEN
    ALTER TABLE "ExecutionRunStep"
    ADD CONSTRAINT "ExecutionRunStep_resultId_fkey"
    FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Result_executionRunId_fkey'
  ) THEN
    ALTER TABLE "Result"
    ADD CONSTRAINT "Result_executionRunId_fkey"
    FOREIGN KEY ("executionRunId") REFERENCES "ExecutionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
