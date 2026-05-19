ALTER TABLE "WorkbenchSession"
ADD COLUMN IF NOT EXISTS "workflowTemplateStepsJson" TEXT;
