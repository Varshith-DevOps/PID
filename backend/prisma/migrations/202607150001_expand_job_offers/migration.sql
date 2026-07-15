ALTER TABLE "job_offers" ADD COLUMN "offeredCtc" DECIMAL;
ALTER TABLE "job_offers" ADD COLUMN "basicSalary" DECIMAL;
ALTER TABLE "job_offers" ADD COLUMN "hra" DECIMAL;
ALTER TABLE "job_offers" ADD COLUMN "specialAllowance" DECIMAL;
ALTER TABLE "job_offers" ADD COLUMN "otherAllowances" DECIMAL;
ALTER TABLE "job_offers" ADD COLUMN "variablePay" DECIMAL;
ALTER TABLE "job_offers" ADD COLUMN "joiningBonus" DECIMAL;
ALTER TABLE "job_offers" ADD COLUMN "workLocation" TEXT;
ALTER TABLE "job_offers" ADD COLUMN "employmentType" TEXT;
ALTER TABLE "job_offers" ADD COLUMN "probationPeriod" TEXT;
ALTER TABLE "job_offers" ADD COLUMN "noticePeriod" TEXT;
ALTER TABLE "job_offers" ADD COLUMN "reportingManager" TEXT;
ALTER TABLE "job_offers" ADD COLUMN "reportingManagerTitle" TEXT;
ALTER TABLE "job_offers" ADD COLUMN "workingHours" TEXT;
ALTER TABLE "job_offers" ADD COLUMN "offerExpiryDate" DATETIME;
ALTER TABLE "job_offers" ADD COLUMN "additionalTerms" TEXT;
ALTER TABLE "job_offers" ADD COLUMN "signatoryName" TEXT;
ALTER TABLE "job_offers" ADD COLUMN "signatoryDesignation" TEXT;
ALTER TABLE "job_offers" ADD COLUMN "pdfFileName" TEXT;
ALTER TABLE "job_offers" ADD COLUMN "pdfStorageKey" TEXT;
ALTER TABLE "job_offers" ADD COLUMN "publicTokenHash" TEXT;
ALTER TABLE "job_offers" ADD COLUMN "tokenExpiresAt" DATETIME;
ALTER TABLE "job_offers" ADD COLUMN "sentAt" DATETIME;
ALTER TABLE "job_offers" ADD COLUMN "viewedAt" DATETIME;
ALTER TABLE "job_offers" ADD COLUMN "acceptedAt" DATETIME;
ALTER TABLE "job_offers" ADD COLUMN "rejectedAt" DATETIME;
ALTER TABLE "job_offers" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "job_offers" ADD COLUMN "candidateResponseName" TEXT;
ALTER TABLE "job_offers" ADD COLUMN "rejectionReason" TEXT;
ALTER TABLE "job_offers" ADD COLUMN "emailStatus" TEXT;
ALTER TABLE "job_offers" ADD COLUMN "emailFailureReason" TEXT;
ALTER TABLE "job_offers" ADD COLUMN "createdBy" TEXT;

UPDATE "job_offers"
SET
  "offeredCtc" = COALESCE("offeredCtc", "offeredSalary"),
  "workLocation" = COALESCE("workLocation", ''),
  "employmentType" = COALESCE("employmentType", 'FULL_TIME'),
  "reportingManager" = COALESCE("reportingManager", 'Reporting Manager'),
  "offerExpiryDate" = COALESCE("offerExpiryDate", DATETIME("joiningDate", '-7 days')),
  "signatoryName" = COALESCE("signatoryName", 'HR Department'),
  "signatoryDesignation" = COALESCE("signatoryDesignation", 'Human Resources'),
  "pdfStorageKey" = COALESCE("pdfStorageKey", "offerLetter"),
  "pdfFileName" = COALESCE("pdfFileName", "offerLetter")
WHERE "offeredCtc" IS NULL;

CREATE INDEX "job_offers_applicantId_idx" ON "job_offers"("applicantId");
CREATE INDEX "job_offers_status_idx" ON "job_offers"("status");
CREATE INDEX "job_offers_publicTokenHash_idx" ON "job_offers"("publicTokenHash");
