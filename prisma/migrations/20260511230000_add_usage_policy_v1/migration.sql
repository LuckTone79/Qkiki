ALTER TABLE "User"
ADD COLUMN "planType" TEXT NOT NULL DEFAULT 'FREE',
ADD COLUMN "billingType" TEXT NOT NULL DEFAULT 'NONE',
ADD COLUMN "trialStartedAt" TIMESTAMP(3),
ADD COLUMN "trialEndsAt" TIMESTAMP(3),
ADD COLUMN "isTrialUsed" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "UsageLimit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "usageDate" DATE NOT NULL,
    "dailyRequestLimit" INTEGER NOT NULL DEFAULT 10,
    "dailyRequestUsed" INTEGER NOT NULL DEFAULT 0,
    "bonusRequestLimit" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageLimit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UsageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "selectedModels" TEXT[] NOT NULL,
    "planTypeSnapshot" TEXT NOT NULL,
    "billingTypeSnapshot" TEXT NOT NULL,
    "isBoostSnapshot" BOOLEAN NOT NULL DEFAULT false,
    "inputCharCount" INTEGER NOT NULL DEFAULT 0,
    "inputTokenCount" INTEGER NOT NULL DEFAULT 0,
    "outputTokenCount" INTEGER NOT NULL DEFAULT 0,
    "requestCountCharged" INTEGER NOT NULL DEFAULT 1,
    "estimatedCostUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreditWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paidCredits" INTEGER NOT NULL DEFAULT 0,
    "bonusCredits" INTEGER NOT NULL DEFAULT 0,
    "totalUsedCredits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditWallet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "planType" TEXT NOT NULL,
    "billingCycle" TEXT NOT NULL,
    "priceKrw" INTEGER NOT NULL,
    "dailyRequestLimit" INTEGER,
    "monthlyCreditLimit" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UsageLimit_userId_usageDate_key" ON "UsageLimit"("userId", "usageDate");
CREATE INDEX "UsageLimit_userId_usageDate_idx" ON "UsageLimit"("userId", "usageDate");
CREATE INDEX "UsageLimit_resetAt_idx" ON "UsageLimit"("resetAt");
CREATE INDEX "UsageLog_userId_createdAt_idx" ON "UsageLog"("userId", "createdAt");
CREATE INDEX "UsageLog_requestType_createdAt_idx" ON "UsageLog"("requestType", "createdAt");
CREATE INDEX "UsageLog_planTypeSnapshot_createdAt_idx" ON "UsageLog"("planTypeSnapshot", "createdAt");
CREATE INDEX "UsageLog_isBoostSnapshot_createdAt_idx" ON "UsageLog"("isBoostSnapshot", "createdAt");
CREATE UNIQUE INDEX "CreditWallet_userId_key" ON "CreditWallet"("userId");
CREATE INDEX "PaymentPlan_planType_isActive_idx" ON "PaymentPlan"("planType", "isActive");

ALTER TABLE "UsageLimit"
ADD CONSTRAINT "UsageLimit_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "UsageLog"
ADD CONSTRAINT "UsageLog_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "CreditWallet"
ADD CONSTRAINT "CreditWallet_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

UPDATE "User"
SET "planType" = 'FREE',
    "billingType" = 'NONE'
WHERE "planType" IS NULL OR "billingType" IS NULL;
