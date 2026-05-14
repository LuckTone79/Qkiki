CREATE TABLE IF NOT EXISTS "ExecutionRun" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sessionId" TEXT,
  "workflowRunId" TEXT,
  "mode" TEXT NOT NULL,
  "requestType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "inputCharCount" INTEGER NOT NULL DEFAULT 0,
  "totalStepsPlanned" INTEGER NOT NULL DEFAULT 0,
  "totalStepsDone" INTEGER NOT NULL DEFAULT 0,
  "finalResultId" TEXT,
  "errorMessage" TEXT,
  "streamError" TEXT,
  "executionSummaryJson" TEXT,
  "usageReservationId" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExecutionRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExecutionRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExecutionRun_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkbenchSession"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExecutionRun_workflowRunId_key" ON "ExecutionRun"("workflowRunId");
CREATE INDEX IF NOT EXISTS "ExecutionRun_userId_status_idx" ON "ExecutionRun"("userId", "status");
CREATE INDEX IF NOT EXISTS "ExecutionRun_sessionId_idx" ON "ExecutionRun"("sessionId");
CREATE INDEX IF NOT EXISTS "ExecutionRun_createdAt_idx" ON "ExecutionRun"("createdAt");

CREATE TABLE IF NOT EXISTS "UsageReservation" (
  "id" TEXT NOT NULL,
  "reservationKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "usageLimitId" TEXT NOT NULL,
  "requestType" TEXT NOT NULL,
  "reservedRequestCount" INTEGER NOT NULL DEFAULT 1,
  "inputCharCount" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'reserved',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "settledAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsageReservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UsageReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UsageReservation_usageLimitId_fkey" FOREIGN KEY ("usageLimitId") REFERENCES "UsageLimit"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "UsageReservation_reservationKey_key" ON "UsageReservation"("reservationKey");
CREATE INDEX IF NOT EXISTS "UsageReservation_userId_status_createdAt_idx" ON "UsageReservation"("userId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "UsageReservation_usageLimitId_status_idx" ON "UsageReservation"("usageLimitId", "status");
CREATE INDEX IF NOT EXISTS "UsageReservation_expiresAt_idx" ON "UsageReservation"("expiresAt");

CREATE TABLE IF NOT EXISTS "ProviderLease" (
  "id" TEXT NOT NULL,
  "providerName" TEXT NOT NULL,
  "leaseKey" TEXT NOT NULL,
  "ownerKind" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "model" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderLease_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProviderLease_leaseKey_key" ON "ProviderLease"("leaseKey");
CREATE INDEX IF NOT EXISTS "ProviderLease_providerName_releasedAt_expiresAt_idx" ON "ProviderLease"("providerName", "releasedAt", "expiresAt");
CREATE INDEX IF NOT EXISTS "ProviderLease_ownerKind_ownerId_idx" ON "ProviderLease"("ownerKind", "ownerId");
CREATE INDEX IF NOT EXISTS "ProviderLease_expiresAt_idx" ON "ProviderLease"("expiresAt");
