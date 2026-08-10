/**
 * Compatibility facade — prefer generateMasterResumePdf / tailorResumeForJob.
 * Kept so older imports of buildMasterResume keep working.
 */
import { buildMasterResumeDocument } from "./template.js";
import { tailorResumeForJob } from "./tailor.js";

/**
 * @deprecated Use tailorResumeForJob for async AI tailor, or buildMasterResumeDocument.
 * Sync heuristic-only builder for tests.
 * @param {object} profile
 * @param {{ job?: object }} [options]
 */
export function buildMasterResume(profile, options = {}) {
  // Sync path: template only (no AI). Callers that need AI must use tailorResumeForJob.
  const master = buildMasterResumeDocument(profile);
  const job = options.job || null;
  if (!job) {
    return {
      fullName: master.fullName,
      headline: master.headline,
      location: master.contact.location,
      email: master.contact.email,
      links: [
        master.contact.website,
        master.contact.github,
        master.contact.linkedin,
      ].filter(Boolean),
      summary: master.summary,
      skills: master.skills,
      skillsByCategory: master.skillsByCategory,
      experiences: master.experiences,
      projects: master.projects.slice(0, 5),
      education: master.education,
      tailoredFor: null,
      contact: master.contact,
    };
  }

  // Lightweight sync heuristic without awaiting Gemini
  const blob = `${job.title || ""} ${job.description || ""} ${(job.skills || []).join(" ")}`.toLowerCase();
  const skills = [...master.skills].sort((a, b) => {
    const sa = blob.includes(a.toLowerCase()) ? 1 : 0;
    const sb = blob.includes(b.toLowerCase()) ? 1 : 0;
    return sb - sa;
  });
  const projects = [...master.projects]
    .sort((a, b) => {
      const sa = (a.stack || []).reduce(
        (n, t) => n + (blob.includes(String(t).toLowerCase()) ? 3 : 0),
        a.featured ? 2 : 0
      );
      const sb = (b.stack || []).reduce(
        (n, t) => n + (blob.includes(String(t).toLowerCase()) ? 3 : 0),
        b.featured ? 2 : 0
      );
      return sb - sa;
    })
    .slice(0, 4);

  return {
    fullName: master.fullName,
    headline: master.headline,
    location: master.contact.location,
    email: master.contact.email,
    links: [
      master.contact.website,
      master.contact.github,
      master.contact.linkedin,
    ].filter(Boolean),
    summary: master.summary,
    skills,
    skillsByCategory: master.skillsByCategory,
    experiences: master.experiences,
    projects,
    education: master.education,
    tailoredFor: { title: job.title || "", company: job.company || "" },
    contact: master.contact,
  };
}

export { buildMasterResumeDocument, tailorResumeForJob };
