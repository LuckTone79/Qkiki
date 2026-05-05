-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sharedContext" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WorkbenchSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "originalInput" TEXT NOT NULL,
    "additionalInstruction" TEXT,
    "outputStyle" TEXT,
    "mode" TEXT NOT NULL,
    "finalResultId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkbenchSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkbenchSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_WorkbenchSession" ("additionalInstruction", "createdAt", "finalResultId", "id", "mode", "originalInput", "outputStyle", "title", "updatedAt", "userId") SELECT "additionalInstruction", "createdAt", "finalResultId", "id", "mode", "originalInput", "outputStyle", "title", "updatedAt", "userId" FROM "WorkbenchSession";
DROP TABLE "WorkbenchSession";
ALTER TABLE "new_WorkbenchSession" RENAME TO "WorkbenchSession";
CREATE INDEX "WorkbenchSession_userId_idx" ON "WorkbenchSession"("userId");
CREATE INDEX "WorkbenchSession_projectId_idx" ON "WorkbenchSession"("projectId");
CREATE INDEX "WorkbenchSession_updatedAt_idx" ON "WorkbenchSession"("updatedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- CreateIndex
CREATE INDEX "Project_updatedAt_idx" ON "Project"("updatedAt");
