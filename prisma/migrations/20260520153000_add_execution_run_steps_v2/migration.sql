-- AlterTable
ALTER TABLE "ExecutionRun"
ADD COLUMN "branchFromOrderIndex" INTEGER,
ADD COLUMN "branchReason" TEXT,
ADD COLUMN "parentExecutionRunId" TEXT,
ADD COLUMN "runnerVersion" TEXT NOT NULL DEFAULT 'v1',
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProviderLease" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UsageReservation" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ExecutionRunStep" (
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

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionRunStep_stepKey_key" ON "ExecutionRunStep"("stepKey");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionRunStep_resultId_key" ON "ExecutionRunStep"("resultId");

-- CreateIndex
CREATE INDEX "ExecutionRunStep_executionRunId_status_idx" ON "ExecutionRunStep"("executionRunId", "status");

-- CreateIndex
CREATE INDEX "ExecutionRunStep_sessionId_executionRunId_idx" ON "ExecutionRunStep"("sessionId", "executionRunId");

-- CreateIndex
CREATE INDEX "ExecutionRunStep_status_nextAttemptAt_idx" ON "ExecutionRunStep"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "ExecutionRunStep_status_lockExpiresAt_idx" ON "ExecutionRunStep"("status", "lockExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionRunStep_executionRunId_orderIndex_key" ON "ExecutionRunStep"("executionRunId", "orderIndex");

-- AddForeignKey
ALTER TABLE "ExecutionRun"
ADD CONSTRAINT "ExecutionRun_parentExecutionRunId_fkey"
FOREIGN KEY ("parentExecutionRunId") REFERENCES "ExecutionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionRunStep"
ADD CONSTRAINT "ExecutionRunStep_executionRunId_fkey"
FOREIGN KEY ("executionRunId") REFERENCES "ExecutionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionRunStep"
ADD CONSTRAINT "ExecutionRunStep_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "WorkbenchSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionRunStep"
ADD CONSTRAINT "ExecutionRunStep_resultId_fkey"
FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result"
ADD CONSTRAINT "Result_executionRunId_fkey"
FOREIGN KEY ("executionRunId") REFERENCES "ExecutionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
