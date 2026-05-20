-- Create attachment tables if the history was missing them.
CREATE TABLE IF NOT EXISTS "SessionAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "extractedText" TEXT,
    "dataBase64" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SessionAttachment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionAttachment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkbenchSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ResultAttachment" (
    "resultId" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResultAttachment_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResultAttachment_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "SessionAttachment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "SessionAttachment" ADD COLUMN IF NOT EXISTS "dataBase64" TEXT;

CREATE INDEX IF NOT EXISTS "SessionAttachment_userId_idx" ON "SessionAttachment"("userId");
CREATE INDEX IF NOT EXISTS "SessionAttachment_sessionId_idx" ON "SessionAttachment"("sessionId");
CREATE INDEX IF NOT EXISTS "SessionAttachment_createdAt_idx" ON "SessionAttachment"("createdAt");
CREATE INDEX IF NOT EXISTS "ResultAttachment_attachmentId_idx" ON "ResultAttachment"("attachmentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ResultAttachment_pkey'
  ) THEN
    ALTER TABLE "ResultAttachment" ADD CONSTRAINT "ResultAttachment_pkey" PRIMARY KEY ("resultId", "attachmentId");
  END IF;
END $$;
