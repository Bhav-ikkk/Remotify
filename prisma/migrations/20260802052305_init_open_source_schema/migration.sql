-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "isRemote" BOOLEAN NOT NULL DEFAULT true,
    "remoteToken" TEXT,
    "salary" TEXT,
    "currency" TEXT,
    "employmentType" TEXT,
    "experience" TEXT,
    "description" TEXT NOT NULL,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "applyUrl" TEXT NOT NULL,
    "companyUrl" TEXT,
    "sourceWebsite" TEXT NOT NULL,
    "postedDate" TIMESTAMP(3),
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiScore" DOUBLE PRECISION,
    "aiMatchedSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aiMissingSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aiReason" TEXT,
    "aiRawResponse" JSONB,
    "isNotified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduler_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'default',
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isRunning" BOOLEAN NOT NULL DEFAULT false,
    "cronExpression" TEXT,
    "targetHourUtc" INTEGER,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "lastRunStatus" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduler_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_histories" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'running',
    "sourcesTargeted" INTEGER NOT NULL DEFAULT 0,
    "jobsParsed" INTEGER NOT NULL DEFAULT 0,
    "jobsDeduplicated" INTEGER NOT NULL DEFAULT 0,
    "jobsProcessed" INTEGER NOT NULL DEFAULT 0,
    "jobsMatched" INTEGER NOT NULL DEFAULT 0,
    "notificationsSent" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "notificationLog" JSONB,
    "metrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "jobs_company_title_idx" ON "jobs"("company", "title");

-- CreateIndex
CREATE INDEX "jobs_aiScore_idx" ON "jobs"("aiScore");

-- CreateIndex
CREATE INDEX "jobs_sourceWebsite_idx" ON "jobs"("sourceWebsite");

-- CreateIndex
CREATE INDEX "jobs_scrapedAt_idx" ON "jobs"("scrapedAt");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_applyUrl_key" ON "jobs"("applyUrl");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "scheduler_configs_name_key" ON "scheduler_configs"("name");

-- CreateIndex
CREATE INDEX "run_histories_startedAt_idx" ON "run_histories"("startedAt");

-- CreateIndex
CREATE INDEX "run_histories_status_idx" ON "run_histories"("status");
