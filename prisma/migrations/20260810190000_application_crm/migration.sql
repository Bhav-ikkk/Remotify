-- Application identity + CRM for free local auto-apply worker

CREATE TABLE "application_identities" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL DEFAULT 'default',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "location" TEXT,
    "linkedinUrl" TEXT,
    "githubUrl" TEXT,
    "portfolioUrl" TEXT,
    "workAuthNotes" TEXT,
    "requiresSponsorship" BOOLEAN NOT NULL DEFAULT false,
    "remoteOk" BOOLEAN NOT NULL DEFAULT true,
    "relocateOk" BOOLEAN NOT NULL DEFAULT false,
    "salaryExpectation" TEXT,
    "noticePeriod" TEXT,
    "coverLetterBlurb" TEXT,
    "extraAnswers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_identities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "application_identities_slug_key" ON "application_identities"("slug");
CREATE INDEX "application_identities_isActive_idx" ON "application_identities"("isActive");

CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "applyUrl" TEXT NOT NULL,
    "atsType" TEXT NOT NULL DEFAULT 'unknown',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "aiScore" DOUBLE PRECISION,
    "resumeFileName" TEXT,
    "resumeMeta" JSONB,
    "formPayload" JSONB,
    "error" TEXT,
    "confirmationText" TEXT,
    "claimedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "workerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "applications_jobId_key" ON "applications"("jobId");
CREATE UNIQUE INDEX "applications_applyUrl_key" ON "applications"("applyUrl");
CREATE INDEX "applications_status_idx" ON "applications"("status");
CREATE INDEX "applications_atsType_idx" ON "applications"("atsType");
CREATE INDEX "applications_submittedAt_idx" ON "applications"("submittedAt");
CREATE INDEX "applications_createdAt_idx" ON "applications"("createdAt");

ALTER TABLE "applications" ADD CONSTRAINT "applications_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
