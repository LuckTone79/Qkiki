ALTER TABLE "Result"
ADD COLUMN "executionRunId" TEXT;

CREATE INDEX "Result_executionRunId_idx" ON "Result"("executionRunId");
