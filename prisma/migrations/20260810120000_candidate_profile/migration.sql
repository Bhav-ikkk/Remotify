-- AlterTable / CreateTables: candidate profile domain for AI matching + master resume

CREATE TABLE "candidate_profiles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "fullName" TEXT NOT NULL,
    "headline" TEXT,
    "summary" TEXT,
    "location" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "websiteUrl" TEXT,
    "portfolioUrl" TEXT,
    "githubUrl" TEXT,
    "linkedinUrl" TEXT,
    "yearsExperience" DOUBLE PRECISION,
    "availability" TEXT,
    "workAuth" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetCompanies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "avoidRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "masterResume" JSONB,
    "rawProfile" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profile_skills" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "proficiency" TEXT,
    "years" DOUBLE PRECISION,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_skills_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profile_projects" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "role" TEXT,
    "status" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "impact" TEXT,
    "stack" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "liveUrl" TEXT,
    "repoUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profile_experiences" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "employmentType" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "stack" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_experiences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profile_education" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "degree" TEXT,
    "field" TEXT,
    "startYear" INTEGER,
    "endYear" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_education_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profile_priorities" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 50,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_priorities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profile_sources" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "label" TEXT,
    "scrapedAt" TIMESTAMP(3),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_sources_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "candidate_profiles_slug_key" ON "candidate_profiles"("slug");
CREATE INDEX "candidate_profiles_isActive_idx" ON "candidate_profiles"("isActive");

CREATE INDEX "profile_skills_category_idx" ON "profile_skills"("category");
CREATE UNIQUE INDEX "profile_skills_profileId_name_key" ON "profile_skills"("profileId", "name");

CREATE INDEX "profile_projects_featured_sortOrder_idx" ON "profile_projects"("featured", "sortOrder");
CREATE UNIQUE INDEX "profile_projects_profileId_slug_key" ON "profile_projects"("profileId", "slug");

CREATE INDEX "profile_experiences_profileId_isCurrent_idx" ON "profile_experiences"("profileId", "isCurrent");

CREATE INDEX "profile_priorities_weight_idx" ON "profile_priorities"("weight");
CREATE UNIQUE INDEX "profile_priorities_profileId_key_key" ON "profile_priorities"("profileId", "key");

CREATE INDEX "profile_sources_type_idx" ON "profile_sources"("type");

ALTER TABLE "profile_skills" ADD CONSTRAINT "profile_skills_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_projects" ADD CONSTRAINT "profile_projects_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_experiences" ADD CONSTRAINT "profile_experiences_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_education" ADD CONSTRAINT "profile_education_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_priorities" ADD CONSTRAINT "profile_priorities_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_sources" ADD CONSTRAINT "profile_sources_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "candidate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
