ALTER TABLE "employees" ADD COLUMN "deactivatedAt" DATETIME;
ALTER TABLE "employees" ADD COLUMN "deactivatedBy" TEXT;
ALTER TABLE "employees" ADD COLUMN "deactivationReason" TEXT;
ALTER TABLE "employees" ADD COLUMN "deactivationRemarks" TEXT;
ALTER TABLE "employees" ADD COLUMN "deactivationEffectiveDate" DATETIME;
ALTER TABLE "employees" ADD COLUMN "reactivatedAt" DATETIME;
ALTER TABLE "employees" ADD COLUMN "reactivatedBy" TEXT;
ALTER TABLE "employees" ADD COLUMN "reactivationRemarks" TEXT;
