-- AlterTable
ALTER TABLE "Result" ADD COLUMN "outputTextCiphertext" TEXT;
ALTER TABLE "Result" ADD COLUMN "outputTextIv" TEXT;
ALTER TABLE "Result" ADD COLUMN "outputTextTag" TEXT;

-- AlterTable
ALTER TABLE "WorkbenchSession" ADD COLUMN "originalInputCiphertext" TEXT;
ALTER TABLE "WorkbenchSession" ADD COLUMN "originalInputIv" TEXT;
ALTER TABLE "WorkbenchSession" ADD COLUMN "originalInputTag" TEXT;

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "mfaVerifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdminSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "detailJson" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminContentAccessLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminUserId" TEXT NOT NULL,
    "viewedUserId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "accessReasonCode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminContentAccessLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdminContentAccessLog_viewedUserId_fkey" FOREIGN KEY ("viewedUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdminContentAccessLog_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WorkbenchSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByAdminId" TEXT NOT NULL,
    "redeemedByUserId" TEXT,
    "redeemedAt" DATETIME,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Coupon_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Coupon_redeemedByUserId_fkey" FOREIGN KEY ("redeemedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "couponId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "note" TEXT,
    "grantStartAt" DATETIME,
    "grantEndAt" DATETIME,
    "grantIsLifetime" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CouponRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "planEndsAt" DATETIME,
    "isLifetime" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubscriptionLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "couponId" TEXT,
    "grantedByAdminId" TEXT,
    "eventType" TEXT NOT NULL,
    "subscriptionType" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME,
    "isLifetime" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriptionLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubscriptionLedger_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SubscriptionLedger_grantedByAdminId_fkey" FOREIGN KEY ("grantedByAdminId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminProviderConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerName" TEXT NOT NULL,
    "defaultModel" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "apiKeyCiphertext" TEXT,
    "apiKeyIv" TEXT,
    "apiKeyTag" TEXT,
    "apiKeyMasked" TEXT,
    "updatedByAdminId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdminProviderConfig_updatedByAdminId_fkey" FOREIGN KEY ("updatedByAdminId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminSystemSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "settingKey" TEXT NOT NULL,
    "valueJson" TEXT NOT NULL,
    "updatedByAdminId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdminSystemSetting_updatedByAdminId_fkey" FOREIGN KEY ("updatedByAdminId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastActiveAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "id", "name", "passwordHash", "updatedAt") SELECT "createdAt", "email", "id", "name", "passwordHash", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminSession_userId_idx" ON "AdminSession"("userId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminUserId_idx" ON "AdminAuditLog"("adminUserId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_action_idx" ON "AdminAuditLog"("action");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminContentAccessLog_adminUserId_idx" ON "AdminContentAccessLog"("adminUserId");

-- CreateIndex
CREATE INDEX "AdminContentAccessLog_viewedUserId_idx" ON "AdminContentAccessLog"("viewedUserId");

-- CreateIndex
CREATE INDEX "AdminContentAccessLog_conversationId_idx" ON "AdminContentAccessLog"("conversationId");

-- CreateIndex
CREATE INDEX "AdminContentAccessLog_createdAt_idx" ON "AdminContentAccessLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Coupon_type_isActive_idx" ON "Coupon"("type", "isActive");

-- CreateIndex
CREATE INDEX "Coupon_redeemedAt_idx" ON "Coupon"("redeemedAt");

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_idx" ON "CouponRedemption"("couponId");

-- CreateIndex
CREATE INDEX "CouponRedemption_userId_idx" ON "CouponRedemption"("userId");

-- CreateIndex
CREATE INDEX "CouponRedemption_createdAt_idx" ON "CouponRedemption"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserSubscription_userId_key" ON "UserSubscription"("userId");

-- CreateIndex
CREATE INDEX "SubscriptionLedger_userId_createdAt_idx" ON "SubscriptionLedger"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminProviderConfig_providerName_key" ON "AdminProviderConfig"("providerName");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSystemSetting_settingKey_key" ON "AdminSystemSetting"("settingKey");
