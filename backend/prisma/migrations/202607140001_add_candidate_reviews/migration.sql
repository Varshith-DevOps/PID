CREATE TABLE "candidate_reviews" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "applicantId" TEXT NOT NULL,
  "reviewerId" TEXT,
  "reviewerName" TEXT NOT NULL,
  "reviewerRole" TEXT,
  "rating" INTEGER NOT NULL,
  "reviewText" TEXT NOT NULL,
  "candidateStage" TEXT NOT NULL,
  "reviewType" TEXT NOT NULL DEFAULT 'GENERAL_REVIEW',
  "interviewRoundId" TEXT,
  "interviewRoundName" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "candidate_reviews_applicantId_fkey"
    FOREIGN KEY ("applicantId") REFERENCES "job_applicants" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "candidate_reviews_applicantId_idx" ON "candidate_reviews"("applicantId");
CREATE INDEX "candidate_reviews_reviewerId_idx" ON "candidate_reviews"("reviewerId");
CREATE INDEX "candidate_reviews_createdAt_idx" ON "candidate_reviews"("createdAt");
