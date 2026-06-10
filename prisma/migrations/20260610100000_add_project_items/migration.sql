-- CreateEnum
CREATE TYPE "ProjectItemKind" AS ENUM ('SESSION', 'RESULT');

-- CreateTable
CREATE TABLE "ProjectItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ProjectItemKind" NOT NULL,
    "sessionId" TEXT NOT NULL,
    "resultId" TEXT,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectItem_projectId_createdAt_idx" ON "ProjectItem"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectItem_userId_idx" ON "ProjectItem"("userId");

-- CreateIndex
CREATE INDEX "ProjectItem_sessionId_idx" ON "ProjectItem"("sessionId");

-- CreateIndex
CREATE INDEX "ProjectItem_resultId_idx" ON "ProjectItem"("resultId");

-- AddForeignKey
ALTER TABLE "ProjectItem" ADD CONSTRAINT "ProjectItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectItem" ADD CONSTRAINT "ProjectItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectItem" ADD CONSTRAINT "ProjectItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkbenchSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectItem" ADD CONSTRAINT "ProjectItem_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE CASCADE ON UPDATE CASCADE;
