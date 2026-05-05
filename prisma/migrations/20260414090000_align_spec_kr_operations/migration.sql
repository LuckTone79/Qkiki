-- Drop the legacy per-user provider-key table. Spec-KR makes provider keys
-- administrator-managed only.
PRAGMA foreign_keys=OFF;
DROP TABLE IF EXISTS "ProviderConfig";
PRAGMA foreign_keys=ON;

-- Extend administrator provider settings for operational controls.
ALTER TABLE "AdminProviderConfig" ADD COLUMN "fallbackProvider" TEXT;
ALTER TABLE "AdminProviderConfig" ADD COLUMN "perUserDailyLimit" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "AdminProviderConfig" ADD COLUMN "timeoutSeconds" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "AdminProviderConfig" ADD COLUMN "healthStatus" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "AdminProviderConfig" ADD COLUMN "lastHealthCheckedAt" DATETIME;

-- Dedicated operational log for every AI provider request.
CREATE TABLE "ai_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "message_id" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "request_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "estimated_cost_usd" REAL,
    "latency_ms" INTEGER,
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ai_requests_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "WorkbenchSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ai_requests_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "Result" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ai_requests_user_id_created_at_idx" ON "ai_requests"("user_id", "created_at");
CREATE INDEX "ai_requests_conversation_id_idx" ON "ai_requests"("conversation_id");
CREATE INDEX "ai_requests_message_id_idx" ON "ai_requests"("message_id");
CREATE INDEX "ai_requests_provider_model_idx" ON "ai_requests"("provider", "model");
CREATE INDEX "ai_requests_status_created_at_idx" ON "ai_requests"("status", "created_at");
