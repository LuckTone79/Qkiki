CREATE TABLE "TrialAccess" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "trialUserId" TEXT NOT NULL,
    "conversationCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "limitReachedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrialAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrialAccess_ipHash_key" ON "TrialAccess"("ipHash");
CREATE UNIQUE INDEX "TrialAccess_trialUserId_key" ON "TrialAccess"("trialUserId");
CREATE INDEX "TrialAccess_startedAt_idx" ON "TrialAccess"("startedAt");

ALTER TABLE "TrialAccess"
ADD CONSTRAINT "TrialAccess_trialUserId_fkey"
FOREIGN KEY ("trialUserId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
