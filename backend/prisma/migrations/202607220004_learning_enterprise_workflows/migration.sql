ALTER TABLE "learning_chapters" ADD COLUMN "minimumTimeMinutes" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "learning_lesson_progress" ADD COLUMN "employeeId" TEXT;
ALTER TABLE "learning_lesson_progress" ADD COLUMN "chapterId" TEXT;
ALTER TABLE "learning_lesson_progress" ADD COLUMN "minimumTimeMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "learning_lesson_progress" ADD COLUMN "chapterStartTime" DATETIME;
ALTER TABLE "learning_lesson_progress" ADD COLUMN "chapterEndTime" DATETIME;
ALTER TABLE "learning_lesson_progress" ADD COLUMN "actualTimeSpent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "learning_lesson_progress" ADD COLUMN "completionPercentage" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "employee_learning_skills" ADD COLUMN "achievedLevel" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "learning_ai_generations" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "courseId" TEXT,
  "sourceType" TEXT NOT NULL,
  "sourceFileName" TEXT,
  "inputPreview" TEXT,
  "generatedJson" TEXT NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'GENERATED',
  "requestedBy" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "learning_feedback" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "courseId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "feedback" TEXT,
  "suggestions" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "learning_lesson_progress_employeeId_idx" ON "learning_lesson_progress"("employeeId");
CREATE INDEX "learning_ai_generations_companyId_idx" ON "learning_ai_generations"("companyId");
CREATE INDEX "learning_ai_generations_courseId_idx" ON "learning_ai_generations"("courseId");
CREATE UNIQUE INDEX "learning_feedback_courseId_employeeId_key" ON "learning_feedback"("courseId", "employeeId");
CREATE INDEX "learning_feedback_companyId_courseId_idx" ON "learning_feedback"("companyId", "courseId");
