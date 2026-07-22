-- Enterprise notification system: additive migration.
ALTER TABLE "notifications" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'IN_APP';
ALTER TABLE "notifications" ADD COLUMN "recipientType" TEXT NOT NULL DEFAULT 'EMPLOYEE';
ALTER TABLE "notifications" ADD COLUMN "recipientId" TEXT;
ALTER TABLE "notifications" ADD COLUMN "recipientEmail" TEXT;
ALTER TABLE "notifications" ADD COLUMN "recipientPhone" TEXT;
ALTER TABLE "notifications" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'QUEUED';
ALTER TABLE "notifications" ADD COLUMN "read" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "notifications" ADD COLUMN "metadata" TEXT;
ALTER TABLE "notifications" ADD COLUMN "scheduledAt" DATETIME;
ALTER TABLE "notifications" ADD COLUMN "sentAt" DATETIME;
ALTER TABLE "notifications" ADD COLUMN "deliveredAt" DATETIME;
ALTER TABLE "notifications" ADD COLUMN "archivedAt" DATETIME;

UPDATE "notifications"
SET "read" = "isRead",
    "status" = CASE WHEN "isRead" = true THEN 'READ' ELSE 'DELIVERED' END
WHERE "status" = 'QUEUED';

CREATE TABLE "notification_templates" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "name" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'EMAIL',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "locale" TEXT NOT NULL DEFAULT 'en-IN',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "notification_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "notification_preferences" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "employeeId" TEXT NOT NULL,
  "module" TEXT NOT NULL DEFAULT 'GENERAL',
  "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "notification_preferences_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "notification_preferences_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "notification_logs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "notificationId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "response" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_logs_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "notification_settings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "smtpHost" TEXT,
  "smtpPort" INTEGER,
  "smtpUsername" TEXT,
  "smtpPassword" TEXT,
  "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
  "smsProvider" TEXT NOT NULL DEFAULT 'MOCK',
  "smsConfig" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 3,
  "reminderTimings" TEXT NOT NULL DEFAULT '24h,1h,15m',
  "emailSignature" TEXT,
  "companyLogo" TEXT,
  "senderName" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "notification_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "notifications_companyId_status_idx" ON "notifications"("companyId", "status");
CREATE INDEX "notifications_employeeId_isRead_idx" ON "notifications"("employeeId", "isRead");
CREATE INDEX "notifications_recipientId_idx" ON "notifications"("recipientId");
CREATE UNIQUE INDEX "notification_templates_companyId_event_channel_locale_key" ON "notification_templates"("companyId", "event", "channel", "locale");
CREATE INDEX "notification_templates_companyId_active_idx" ON "notification_templates"("companyId", "active");
CREATE UNIQUE INDEX "notification_preferences_employeeId_module_key" ON "notification_preferences"("employeeId", "module");
CREATE INDEX "notification_preferences_companyId_idx" ON "notification_preferences"("companyId");
CREATE INDEX "notification_logs_notificationId_idx" ON "notification_logs"("notificationId");
CREATE INDEX "notification_logs_status_createdAt_idx" ON "notification_logs"("status", "createdAt");
CREATE UNIQUE INDEX "notification_settings_companyId_key" ON "notification_settings"("companyId");
