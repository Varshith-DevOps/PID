CREATE TABLE "learning_course_versions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "courseId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "snapshotJson" TEXT NOT NULL DEFAULT '{}',
  "changeSummary" TEXT,
  "createdBy" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "learning_course_approvals" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "courseId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "requestedBy" TEXT,
  "reviewedBy" TEXT,
  "reviewerComment" TEXT,
  "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" DATETIME
);

CREATE TABLE "learning_course_mappings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "courseId" TEXT NOT NULL,
  "mappingType" TEXT NOT NULL,
  "mappingValue" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "learning_course_prerequisites" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "courseId" TEXT NOT NULL,
  "prerequisiteCourseId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "learning_chapters" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "courseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isPreview" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "learning_lessons" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "courseId" TEXT NOT NULL,
  "chapterId" TEXT,
  "title" TEXT NOT NULL,
  "lessonType" TEXT NOT NULL DEFAULT 'VIDEO',
  "contentUrl" TEXT,
  "embedUrl" TEXT,
  "fileName" TEXT,
  "filePath" TEXT,
  "mimeType" TEXT,
  "durationMinutes" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "resourcesJson" TEXT NOT NULL DEFAULT '[]',
  "isPreview" BOOLEAN NOT NULL DEFAULT false,
  "isDownloadable" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "learning_paths" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "pathType" TEXT NOT NULL DEFAULT 'OPTIONAL',
  "targetType" TEXT NOT NULL DEFAULT 'COMPANY',
  "targetValue" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdBy" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "learning_path_courses" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "pathId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "learning_path_assignments" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "pathId" TEXT NOT NULL,
  "employeeId" TEXT,
  "department" TEXT,
  "designation" TEXT,
  "dueDate" DATETIME,
  "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
  "assignedBy" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "learning_lesson_progress" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "enrollmentId" TEXT NOT NULL,
  "lessonId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "timeSpentMins" INTEGER NOT NULL DEFAULT 0,
  "lastViewedAt" DATETIME,
  "completedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "learning_notes" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "employeeId" TEXT NOT NULL,
  "courseId" TEXT,
  "lessonId" TEXT,
  "note" TEXT NOT NULL,
  "isPrivate" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "learning_favorites" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "employeeId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "learning_question_bank" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "courseId" TEXT,
  "skillId" TEXT,
  "question" TEXT NOT NULL,
  "questionType" TEXT NOT NULL DEFAULT 'MCQ',
  "optionsJson" TEXT NOT NULL DEFAULT '[]',
  "correctAnswer" TEXT,
  "explanation" TEXT,
  "difficulty" TEXT NOT NULL DEFAULT 'BEGINNER',
  "marks" INTEGER NOT NULL DEFAULT 1,
  "negativeMarks" REAL,
  "tags" TEXT,
  "createdBy" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "learning_assessments" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "courseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "assessmentType" TEXT NOT NULL DEFAULT 'ASSIGNMENT',
  "instructions" TEXT,
  "rubricJson" TEXT NOT NULL DEFAULT '[]',
  "maxMarks" INTEGER NOT NULL DEFAULT 100,
  "dueDate" DATETIME,
  "attemptLimit" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdBy" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "learning_assessment_submissions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "assessmentId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL DEFAULT 1,
  "submissionText" TEXT,
  "fileUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "marks" INTEGER,
  "feedback" TEXT,
  "reviewedBy" TEXT,
  "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "learning_skills" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "learning_course_skills" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "courseId" TEXT NOT NULL,
  "skillId" TEXT NOT NULL,
  "targetLevel" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "employee_learning_skills" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "employeeId" TEXT NOT NULL,
  "skillId" TEXT NOT NULL,
  "currentLevel" INTEGER NOT NULL DEFAULT 0,
  "targetLevel" INTEGER NOT NULL DEFAULT 1,
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "lastAssessedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "learning_certificate_templates" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "name" TEXT NOT NULL,
  "bodyJson" TEXT NOT NULL DEFAULT '{}',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "learning_certificate_archives" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "certificateId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ARCHIVED',
  "archivedBy" TEXT,
  "archivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "restoredAt" DATETIME,
  "restoredBy" TEXT
);

CREATE TABLE "training_sessions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "courseId" TEXT,
  "title" TEXT NOT NULL,
  "instructor" TEXT,
  "location" TEXT,
  "sessionType" TEXT NOT NULL DEFAULT 'VIRTUAL',
  "startsAt" DATETIME NOT NULL,
  "endsAt" DATETIME NOT NULL,
  "capacity" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "createdBy" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "learning_settings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT,
  "autoAssignOnboarding" BOOLEAN NOT NULL DEFAULT false,
  "defaultReminderDays" INTEGER NOT NULL DEFAULT 7,
  "certificatePrefix" TEXT NOT NULL DEFAULT 'PID-LRN',
  "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
  "visibilityRulesJson" TEXT NOT NULL DEFAULT '{}',
  "enrollmentRulesJson" TEXT NOT NULL DEFAULT '{}',
  "updatedBy" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "learning_course_versions_courseId_versionNumber_key" ON "learning_course_versions"("courseId", "versionNumber");
CREATE INDEX "learning_course_versions_companyId_courseId_idx" ON "learning_course_versions"("companyId", "courseId");
CREATE INDEX "learning_course_approvals_companyId_status_idx" ON "learning_course_approvals"("companyId", "status");
CREATE INDEX "learning_course_approvals_courseId_status_idx" ON "learning_course_approvals"("courseId", "status");
CREATE UNIQUE INDEX "learning_course_mappings_courseId_mappingType_mappingValue_key" ON "learning_course_mappings"("courseId", "mappingType", "mappingValue");
CREATE INDEX "learning_course_mappings_companyId_mappingType_idx" ON "learning_course_mappings"("companyId", "mappingType");
CREATE UNIQUE INDEX "learning_course_prerequisites_courseId_prerequisiteCourseId_key" ON "learning_course_prerequisites"("courseId", "prerequisiteCourseId");
CREATE INDEX "learning_course_prerequisites_companyId_idx" ON "learning_course_prerequisites"("companyId");
CREATE INDEX "learning_course_prerequisites_prerequisiteCourseId_idx" ON "learning_course_prerequisites"("prerequisiteCourseId");
CREATE INDEX "learning_chapters_companyId_courseId_idx" ON "learning_chapters"("companyId", "courseId");
CREATE INDEX "learning_lessons_companyId_courseId_idx" ON "learning_lessons"("companyId", "courseId");
CREATE INDEX "learning_lessons_chapterId_idx" ON "learning_lessons"("chapterId");
CREATE INDEX "learning_paths_companyId_status_idx" ON "learning_paths"("companyId", "status");
CREATE UNIQUE INDEX "learning_path_courses_pathId_courseId_key" ON "learning_path_courses"("pathId", "courseId");
CREATE INDEX "learning_path_courses_companyId_idx" ON "learning_path_courses"("companyId");
CREATE INDEX "learning_path_courses_courseId_idx" ON "learning_path_courses"("courseId");
CREATE INDEX "learning_path_assignments_companyId_status_idx" ON "learning_path_assignments"("companyId", "status");
CREATE INDEX "learning_path_assignments_pathId_idx" ON "learning_path_assignments"("pathId");
CREATE UNIQUE INDEX "learning_lesson_progress_enrollmentId_lessonId_key" ON "learning_lesson_progress"("enrollmentId", "lessonId");
CREATE INDEX "learning_lesson_progress_companyId_idx" ON "learning_lesson_progress"("companyId");
CREATE INDEX "learning_lesson_progress_lessonId_idx" ON "learning_lesson_progress"("lessonId");
CREATE INDEX "learning_notes_companyId_idx" ON "learning_notes"("companyId");
CREATE INDEX "learning_notes_employeeId_courseId_idx" ON "learning_notes"("employeeId", "courseId");
CREATE UNIQUE INDEX "learning_favorites_employeeId_courseId_key" ON "learning_favorites"("employeeId", "courseId");
CREATE INDEX "learning_favorites_companyId_idx" ON "learning_favorites"("companyId");
CREATE INDEX "learning_question_bank_companyId_courseId_idx" ON "learning_question_bank"("companyId", "courseId");
CREATE INDEX "learning_assessments_companyId_courseId_idx" ON "learning_assessments"("companyId", "courseId");
CREATE INDEX "learning_assessment_submissions_companyId_idx" ON "learning_assessment_submissions"("companyId");
CREATE INDEX "learning_assessment_submissions_assessmentId_employeeId_idx" ON "learning_assessment_submissions"("assessmentId", "employeeId");
CREATE INDEX "learning_assessment_submissions_enrollmentId_idx" ON "learning_assessment_submissions"("enrollmentId");
CREATE UNIQUE INDEX "learning_skills_companyId_name_key" ON "learning_skills"("companyId", "name");
CREATE INDEX "learning_skills_companyId_idx" ON "learning_skills"("companyId");
CREATE UNIQUE INDEX "learning_course_skills_courseId_skillId_key" ON "learning_course_skills"("courseId", "skillId");
CREATE INDEX "learning_course_skills_companyId_idx" ON "learning_course_skills"("companyId");
CREATE INDEX "learning_course_skills_skillId_idx" ON "learning_course_skills"("skillId");
CREATE UNIQUE INDEX "employee_learning_skills_employeeId_skillId_key" ON "employee_learning_skills"("employeeId", "skillId");
CREATE INDEX "employee_learning_skills_companyId_idx" ON "employee_learning_skills"("companyId");
CREATE INDEX "employee_learning_skills_skillId_idx" ON "employee_learning_skills"("skillId");
CREATE UNIQUE INDEX "learning_certificate_templates_companyId_name_key" ON "learning_certificate_templates"("companyId", "name");
CREATE INDEX "learning_certificate_templates_companyId_isActive_idx" ON "learning_certificate_templates"("companyId", "isActive");
CREATE INDEX "learning_certificate_archives_companyId_idx" ON "learning_certificate_archives"("companyId");
CREATE INDEX "learning_certificate_archives_employeeId_idx" ON "learning_certificate_archives"("employeeId");
CREATE INDEX "learning_certificate_archives_certificateId_idx" ON "learning_certificate_archives"("certificateId");
CREATE INDEX "training_sessions_companyId_startsAt_idx" ON "training_sessions"("companyId", "startsAt");
CREATE UNIQUE INDEX "learning_settings_companyId_key" ON "learning_settings"("companyId");
