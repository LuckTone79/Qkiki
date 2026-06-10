-- CreateTable
CREATE TABLE "ParallelComparison" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "comparedResultIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParallelComparison_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParallelComparison_sessionId_idx" ON "ParallelComparison"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ParallelComparison_sessionId_signature_key" ON "ParallelComparison"("sessionId", "signature");

-- AddForeignKey
ALTER TABLE "ParallelComparison" ADD CONSTRAINT "ParallelComparison_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkbenchSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
