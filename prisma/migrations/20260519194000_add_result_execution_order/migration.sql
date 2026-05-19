ALTER TABLE "Result"
ADD COLUMN IF NOT EXISTS "executionOrder" INTEGER;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "executionRunId", "executionOrder"
      ORDER BY
        CASE "status"
          WHEN 'completed' THEN 0
          WHEN 'running' THEN 1
          WHEN 'failed' THEN 2
          WHEN 'canceled' THEN 3
          ELSE 4
        END,
        "updatedAt" DESC,
        "createdAt" ASC
    ) AS rn
  FROM "Result"
  WHERE "executionRunId" IS NOT NULL
    AND "executionOrder" IS NOT NULL
)
UPDATE "Result"
SET "executionOrder" = NULL
WHERE id IN (
  SELECT id
  FROM ranked
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "Result_executionRunId_executionOrder_key"
ON "Result"("executionRunId", "executionOrder");
