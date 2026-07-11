-- Hash all bearer links in-place, bound their lifetime, and revoke the token
-- that was exposed in repository history. The physical column remains named
-- "token" so the conversion is atomic with the Prisma field mapping.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "SharedLinkScope" AS ENUM ('SESSION', 'RESULT');

ALTER TABLE "SharedLink"
  ADD COLUMN "scope" "SharedLinkScope" NOT NULL DEFAULT 'SESSION',
  ADD COLUMN "resultId" TEXT,
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "revokedAt" TIMESTAMP(3);

UPDATE "SharedLink"
SET
  "token" = encode(digest("token", 'sha256'), 'hex'),
  "expiresAt" = LEAST("createdAt" + INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '24 hours');

UPDATE "SharedLink"
SET "revokedAt" = CURRENT_TIMESTAMP
WHERE "token" = '60e34c06400f3f93364c9086aa2f3a116c222a112eae9312d2f9cbccecc25b5a';

ALTER TABLE "SharedLink" ALTER COLUMN "expiresAt" SET NOT NULL;

DROP INDEX IF EXISTS "SharedLink_sessionId_key";
CREATE INDEX "SharedLink_sessionId_idx" ON "SharedLink"("sessionId");
CREATE INDEX "SharedLink_resultId_idx" ON "SharedLink"("resultId");
CREATE INDEX "SharedLink_expiresAt_idx" ON "SharedLink"("expiresAt");

ALTER TABLE "TrialAccess" ADD COLUMN "browserTokenHash" TEXT;
CREATE UNIQUE INDEX "TrialAccess_browserTokenHash_key" ON "TrialAccess"("browserTokenHash");

-- Historical audit events are useful, but old free-form details may contain
-- credentials or coupon bearer codes. Keep the event while removing its payload.
UPDATE "AdminAuditLog"
SET "detailJson" = '{"redacted":true,"reason":"security_migration"}'
WHERE "detailJson" IS NOT NULL
  AND (
    "action"::text LIKE 'COUPON_%'
    OR "detailJson" ~* '"(code|token|password|authorization|api[_-]?key|secret)"'
  );
