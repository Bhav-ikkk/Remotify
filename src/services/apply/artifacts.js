import { createHash } from "node:crypto";
import { prisma } from "../database.js";

/**
 * Persist the exact resume PDF bytes for an application (resume provenance).
 * Upserts so a re-queued application keeps only its latest uploaded version.
 *
 * @param {{
 *   applicationId: string,
 *   fileName: string,
 *   buffer: Buffer,
 *   contentType?: string,
 * }} input
 * @returns {Promise<{ id: string, sha256: string, byteSize: number }>}
 */
export async function storeResumeArtifact(input) {
  const { applicationId, fileName, buffer } = input;
  const contentType = input.contentType || "application/pdf";
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  const artifact = await prisma.resumeArtifact.upsert({
    where: { applicationId },
    create: {
      applicationId,
      fileName,
      contentType,
      byteSize: buffer.length,
      sha256,
      data: buffer,
    },
    update: {
      fileName,
      contentType,
      byteSize: buffer.length,
      sha256,
      data: buffer,
    },
  });

  return { id: artifact.id, sha256, byteSize: buffer.length };
}

/**
 * @param {string} applicationId
 * @returns {Promise<object|null>}
 */
export async function getResumeArtifact(applicationId) {
  return prisma.resumeArtifact.findUnique({ where: { applicationId } });
}
