-- Expand the existing additive Learning Management module.
ALTER TABLE "learning_courses" ADD COLUMN "courseCode" TEXT;
ALTER TABLE "learning_courses" ADD COLUMN "department" TEXT;
ALTER TABLE "learning_courses" ADD COLUMN "difficulty" TEXT NOT NULL DEFAULT 'BEGINNER';
ALTER TABLE "learning_courses" ADD COLUMN "durationMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "learning_courses" ADD COLUMN "instructor" TEXT;
ALTER TABLE "learning_courses" ADD COLUMN "thumbnailUrl" TEXT;
ALTER TABLE "learning_courses" ADD COLUMN "bannerUrl" TEXT;
ALTER TABLE "learning_courses" ADD COLUMN "tags" TEXT;
ALTER TABLE "learning_courses" ADD COLUMN "prerequisites" TEXT;
ALTER TABLE "learning_courses" ADD COLUMN "passingScore" INTEGER NOT NULL DEFAULT 70;
ALTER TABLE "learning_courses" ADD COLUMN "certificateAvailable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "learning_courses" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT';

ALTER TABLE "learning_enrollments" ADD COLUMN "assignmentId" TEXT;
ALTER TABLE "learning_enrollments" ADD COLUMN "timeSpentMins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "learning_enrollments" ADD COLUMN "lastAccessedAt" DATETIME;

CREATE TABLE "learning_categories" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "course_materials" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "courseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "materialType" TEXT NOT NULL,
  "fileName" TEXT,
  "filePath" TEXT,
  "fileSize" INTEGER,
  "mimeType" TEXT,
  "externalUrl" TEXT,
  "isDownloadable" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "course_materials_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning_courses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "course_assignments" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "courseId" TEXT NOT NULL,
  "assignmentType" TEXT NOT NULL,
  "employeeId" TEXT,
  "department" TEXT,
  "designation" TEXT,
  "dueDate" DATETIME,
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "notifyEmployees" BOOLEAN NOT NULL DEFAULT true,
  "assignedBy" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "course_assignments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning_courses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "quizzes" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "courseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "passingMarks" INTEGER NOT NULL DEFAULT 70,
  "timeLimitMins" INTEGER,
  "attemptLimit" INTEGER NOT NULL DEFAULT 1,
  "randomize" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quizzes_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning_courses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "quiz_questions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "quizId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "questionType" TEXT NOT NULL DEFAULT 'MULTIPLE_CHOICE',
  "options" TEXT,
  "correctAnswer" TEXT NOT NULL,
  "marks" INTEGER NOT NULL DEFAULT 1,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quiz_questions_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "quiz_attempts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "quizId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  "percentage" REAL NOT NULL DEFAULT 0,
  "attemptNumber" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'FAIL',
  "answers" TEXT,
  "completionMins" INTEGER,
  "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quiz_attempts_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "quiz_attempts_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "learning_enrollments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "certificates" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "courseId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "enrollmentId" TEXT,
  "certificateNumber" TEXT NOT NULL,
  "employeeName" TEXT NOT NULL,
  "courseName" TEXT NOT NULL,
  "completionDate" DATETIME NOT NULL,
  "fileUrl" TEXT,
  "qrCode" TEXT,
  "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "certificates_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning_courses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "certificates_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "certificates_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "learning_enrollments" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "learning_notifications" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "employeeId" TEXT,
  "courseId" TEXT,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "learning_notifications_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "learning_notifications_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning_courses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "learning_bookmarks" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "employeeId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "learning_bookmarks_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "learning_bookmarks_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning_courses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "learning_audit_logs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "actorId" TEXT,
  "actorEmail" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "details" TEXT,
  "ipAddress" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "learning_courses_companyId_courseCode_key" ON "learning_courses"("companyId", "courseCode");
CREATE INDEX "learning_courses_companyId_status_idx" ON "learning_courses"("companyId", "status");
CREATE INDEX "learning_enrollments_employeeId_status_idx" ON "learning_enrollments"("employeeId", "status");
CREATE UNIQUE INDEX "learning_categories_companyId_name_key" ON "learning_categories"("companyId", "name");
CREATE INDEX "learning_categories_companyId_idx" ON "learning_categories"("companyId");
CREATE INDEX "course_materials_courseId_idx" ON "course_materials"("courseId");
CREATE INDEX "course_assignments_companyId_idx" ON "course_assignments"("companyId");
CREATE INDEX "course_assignments_courseId_idx" ON "course_assignments"("courseId");
CREATE INDEX "quizzes_courseId_idx" ON "quizzes"("courseId");
CREATE INDEX "quiz_questions_quizId_idx" ON "quiz_questions"("quizId");
CREATE INDEX "quiz_attempts_quizId_idx" ON "quiz_attempts"("quizId");
CREATE INDEX "quiz_attempts_enrollmentId_idx" ON "quiz_attempts"("enrollmentId");
CREATE INDEX "certificates_employeeId_idx" ON "certificates"("employeeId");
CREATE INDEX "certificates_courseId_idx" ON "certificates"("courseId");
CREATE UNIQUE INDEX "certificates_enrollmentId_key" ON "certificates"("enrollmentId");
CREATE UNIQUE INDEX "certificates_certificateNumber_key" ON "certificates"("certificateNumber");
CREATE INDEX "learning_notifications_employeeId_idx" ON "learning_notifications"("employeeId");
CREATE INDEX "learning_notifications_courseId_idx" ON "learning_notifications"("courseId");
CREATE UNIQUE INDEX "learning_bookmarks_employeeId_courseId_key" ON "learning_bookmarks"("employeeId", "courseId");
CREATE INDEX "learning_audit_logs_companyId_idx" ON "learning_audit_logs"("companyId");
