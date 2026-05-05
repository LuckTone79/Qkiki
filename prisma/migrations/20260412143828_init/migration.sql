-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuthAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProviderConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "defaultModel" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "usesEnvKey" BOOLEAN NOT NULL DEFAULT false,
    "apiKeyCiphertext" TEXT,
    "apiKeyIv" TEXT,
    "apiKeyTag" TEXT,
    "keyHint" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProviderConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkbenchSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalInput" TEXT NOT NULL,
    "additionalInstruction" TEXT,
    "outputStyle" TEXT,
    "mode" TEXT NOT NULL,
    "finalResultId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkbenchSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "actionType" TEXT NOT NULL,
    "targetProvider" TEXT NOT NULL,
    "targetModel" TEXT NOT NULL,
    "sourceMode" TEXT NOT NULL,
    "sourceResultId" TEXT,
    "instructionTemplate" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkflowStep_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkbenchSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "workflowStepId" TEXT,
    "parentResultId" TEXT,
    "branchKey" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptSnapshot" TEXT NOT NULL,
    "outputText" TEXT,
    "rawResponse" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "tokenUsagePrompt" INTEGER,
    "tokenUsageCompletion" INTEGER,
    "estimatedCost" REAL,
    "costIsEstimated" BOOLEAN NOT NULL DEFAULT false,
    "latencyMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Result_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkbenchSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Result_workflowStepId_fkey" FOREIGN KEY ("workflowStepId") REFERENCES "WorkflowStep" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Result_parentResultId_fkey" FOREIGN KEY ("parentResultId") REFERENCES "Result" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Preset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "workflowJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Preset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AuthAccount_userId_idx" ON "AuthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthAccount_provider_providerAccountId_key" ON "AuthAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "ProviderConfig_userId_idx" ON "ProviderConfig"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderConfig_userId_providerName_key" ON "ProviderConfig"("userId", "providerName");

-- CreateIndex
CREATE INDEX "WorkbenchSession_userId_idx" ON "WorkbenchSession"("userId");

-- CreateIndex
CREATE INDEX "WorkbenchSession_updatedAt_idx" ON "WorkbenchSession"("updatedAt");

-- CreateIndex
CREATE INDEX "WorkflowStep_sessionId_idx" ON "WorkflowStep"("sessionId");

-- CreateIndex
CREATE INDEX "WorkflowStep_sourceResultId_idx" ON "WorkflowStep"("sourceResultId");

-- CreateIndex
CREATE INDEX "Result_sessionId_idx" ON "Result"("sessionId");

-- CreateIndex
CREATE INDEX "Result_workflowStepId_idx" ON "Result"("workflowStepId");

-- CreateIndex
CREATE INDEX "Result_parentResultId_idx" ON "Result"("parentResultId");

-- CreateIndex
CREATE INDEX "Preset_userId_idx" ON "Preset"("userId");
