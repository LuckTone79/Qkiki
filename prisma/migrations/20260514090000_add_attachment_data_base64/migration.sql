-- Persist attachment bytes so serverless runs can hydrate files across requests.
ALTER TABLE "SessionAttachment" ADD COLUMN "dataBase64" TEXT;
