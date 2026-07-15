ALTER TABLE "interviews" ADD COLUMN "interviewMode" TEXT;
ALTER TABLE "interviews" ADD COLUMN "meetingLink" TEXT;
ALTER TABLE "interviews" ADD COLUMN "location" TEXT;
ALTER TABLE "interviews" ADD COLUMN "instructions" TEXT;
ALTER TABLE "interviews" ADD COLUMN "emailStatus" TEXT DEFAULT 'PENDING';
ALTER TABLE "interviews" ADD COLUMN "emailSentAt" DATETIME;
ALTER TABLE "interviews" ADD COLUMN "emailFailureReason" TEXT;
