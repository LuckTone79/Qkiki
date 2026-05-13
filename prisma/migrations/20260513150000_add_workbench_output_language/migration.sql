-- Add default output language preference for persisted workbench sessions.
ALTER TABLE "WorkbenchSession" ADD COLUMN "outputLanguage" TEXT;
