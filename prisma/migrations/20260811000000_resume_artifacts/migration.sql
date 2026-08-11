-- Durable resume provenance: exact PDF bytes uploaded per application

CREATE TABLE "resume_artifacts" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'application/pdf',
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resume_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "resume_artifacts_applicationId_key" ON "resume_artifacts"("applicationId");

ALTER TABLE "resume_artifacts" ADD CONSTRAINT "resume_artifacts_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
