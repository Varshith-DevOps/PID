CREATE TABLE "ai_candidate_assessments" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT,
  "organizationId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
  "skillsScore" REAL NOT NULL DEFAULT 0,
  "experienceScore" REAL NOT NULL DEFAULT 0,
  "educationScore" REAL NOT NULL DEFAULT 0,
  "projectScore" REAL NOT NULL DEFAULT 0,
  "certificationScore" REAL NOT NULL DEFAULT 0,
  "domainScore" REAL NOT NULL DEFAULT 0,
  "overallScore" REAL NOT NULL DEFAULT 0,
  "confidence" REAL NOT NULL DEFAULT 0,
  "matchedSkills" TEXT NOT NULL DEFAULT '[]',
  "missingRequiredSkills" TEXT NOT NULL DEFAULT '[]',
  "missingPreferredSkills" TEXT NOT NULL DEFAULT '[]',
  "evidence" TEXT NOT NULL DEFAULT '{}',
  "recruiterNotes" TEXT NOT NULL DEFAULT '',
  "recommendation" TEXT NOT NULL,
  "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "approvedBy" TEXT,
  "approvedAt" DATETIME,
  "approvalComments" TEXT,
  "approvalHistory" TEXT NOT NULL DEFAULT '[]',
  "modelProvider" TEXT,
  "modelName" TEXT,
  "promptVersion" TEXT,
  "scoringVersion" TEXT,
  "createdBy" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ai_candidate_assessments_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "job_openings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_candidate_assessments_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "job_applicants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ai_candidate_assessments_workflowId_key" ON "ai_candidate_assessments"("workflowId");
CREATE INDEX "ai_candidate_assessments_tenantId_idx" ON "ai_candidate_assessments"("tenantId");
CREATE INDEX "ai_candidate_assessments_companyId_idx" ON "ai_candidate_assessments"("companyId");
CREATE INDEX "ai_candidate_assessments_organizationId_idx" ON "ai_candidate_assessments"("organizationId");
CREATE INDEX "ai_candidate_assessments_jobId_idx" ON "ai_candidate_assessments"("jobId");
CREATE INDEX "ai_candidate_assessments_applicationId_idx" ON "ai_candidate_assessments"("applicationId");
CREATE INDEX "ai_candidate_assessments_candidateId_idx" ON "ai_candidate_assessments"("candidateId");
CREATE INDEX "ai_candidate_assessments_workflowId_idx" ON "ai_candidate_assessments"("workflowId");
CREATE INDEX "ai_candidate_assessments_approvalStatus_idx" ON "ai_candidate_assessments"("approvalStatus");
CREATE INDEX "ai_candidate_assessments_createdAt_idx" ON "ai_candidate_assessments"("createdAt");
