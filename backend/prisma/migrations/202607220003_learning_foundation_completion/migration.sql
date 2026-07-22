ALTER TABLE "learning_courses" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "learning_courses" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "learning_courses" ADD COLUMN "estimatedHours" REAL;
ALTER TABLE "learning_courses" ADD COLUMN "learningObjectives" TEXT;
ALTER TABLE "learning_courses" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'EMPLOYEES';

ALTER TABLE "learning_categories" ADD COLUMN "parentId" TEXT;
ALTER TABLE "learning_categories" ADD COLUMN "icon" TEXT;
ALTER TABLE "learning_categories" ADD COLUMN "color" TEXT;

ALTER TABLE "learning_chapters" ADD COLUMN "prerequisiteJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "learning_chapters" ADD COLUMN "completionRuleJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "learning_chapters" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "learning_chapters" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "learning_lessons" ADD COLUMN "richText" TEXT;
ALTER TABLE "learning_lessons" ADD COLUMN "isMandatory" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "learning_lessons" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "learning_lessons" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "learning_courses_categoryId_idx" ON "learning_courses"("categoryId");
CREATE INDEX "learning_categories_parentId_idx" ON "learning_categories"("parentId");
CREATE INDEX "learning_chapters_courseId_sortOrder_idx" ON "learning_chapters"("courseId", "sortOrder");
CREATE INDEX "learning_lessons_courseId_sortOrder_idx" ON "learning_lessons"("courseId", "sortOrder");