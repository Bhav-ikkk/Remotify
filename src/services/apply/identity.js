import { prisma } from "../database.js";
import { loadMasterResume } from "../resume/template.js";

/**
 * Resolve the active ApplicationIdentity as a live projection of the active
 * CandidateProfile's master resume — never a write-once seed. Every call
 * re-syncs contact facts (name, email, phone, location, links) from the DB
 * master resume, so a stale first-write can never lock in wrong data.
 *
 * Preference fields the resume does not own (work auth, sponsorship, salary,
 * notice period, cover letter blurb) are only overwritten when the master
 * resume document provides them under an `identity` key; otherwise existing
 * values are preserved.
 *
 * Fails loudly when no complete master resume exists in the DB — a real
 * application must never run with placeholder identity data.
 */
export async function ensureApplicationIdentity() {
  const { source, data } = await loadMasterResume();
  if (source !== "db") {
    throw new Error(
      "RESUME_DEMO=1 demo resume cannot back an application identity. Unset RESUME_DEMO and import your real master resume with `npm run resume:sync`."
    );
  }

  const contact = data.contact || {};
  const identityCfg =
    data.identity && typeof data.identity === "object" ? data.identity : {};

  const projected = {
    fullName: data.displayName || data.fullName,
    email: contact.email,
    phone: contact.phone || null,
    location: contact.location || null,
    linkedinUrl: contact.linkedinUrl || null,
    githubUrl: contact.githubUrl || null,
    portfolioUrl: contact.portfolioUrl || null,
  };

  /** @type {Record<string, unknown>} */
  const preferences = {};
  if (typeof identityCfg.workAuthNotes === "string") {
    preferences.workAuthNotes = identityCfg.workAuthNotes;
  }
  if (typeof identityCfg.requiresSponsorship === "boolean") {
    preferences.requiresSponsorship = identityCfg.requiresSponsorship;
  }
  if (typeof identityCfg.remoteOk === "boolean") {
    preferences.remoteOk = identityCfg.remoteOk;
  }
  if (typeof identityCfg.relocateOk === "boolean") {
    preferences.relocateOk = identityCfg.relocateOk;
  }
  if (typeof identityCfg.salaryExpectation === "string") {
    preferences.salaryExpectation = identityCfg.salaryExpectation;
  }
  if (typeof identityCfg.noticePeriod === "string") {
    preferences.noticePeriod = identityCfg.noticePeriod;
  }
  if (typeof identityCfg.coverLetterBlurb === "string") {
    preferences.coverLetterBlurb = identityCfg.coverLetterBlurb;
  }

  const defaultBlurb =
    String(data.summary || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 600) || null;

  return prisma.applicationIdentity.upsert({
    where: { slug: "default" },
    create: {
      slug: "default",
      isActive: true,
      workAuthNotes: null,
      requiresSponsorship: false,
      remoteOk: true,
      relocateOk: false,
      salaryExpectation: null,
      noticePeriod: null,
      coverLetterBlurb: defaultBlurb,
      ...projected,
      ...preferences,
    },
    update: { isActive: true, ...projected, ...preferences },
  });
}

/**
 * @returns {Promise<object|null>}
 */
export async function getActiveIdentity() {
  return prisma.applicationIdentity.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Flatten identity into common form field aliases for adapters.
 * @param {object} identity
 */
export function identityToFormFields(identity) {
  const fullName = String(identity?.fullName || "").trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ") || parts[0] || "";

  return {
    fullName,
    firstName,
    lastName,
    email: identity?.email || "",
    phone: identity?.phone || "",
    location: identity?.location || "",
    linkedinUrl: identity?.linkedinUrl || "",
    githubUrl: identity?.githubUrl || "",
    portfolioUrl: identity?.portfolioUrl || "",
    website: identity?.portfolioUrl || "",
    requiresSponsorship: Boolean(identity?.requiresSponsorship),
    remoteOk: identity?.remoteOk !== false,
    relocateOk: Boolean(identity?.relocateOk),
    salaryExpectation: identity?.salaryExpectation || "",
    noticePeriod: identity?.noticePeriod || "",
    coverLetter: identity?.coverLetterBlurb || "",
    workAuthNotes: identity?.workAuthNotes || "",
  };
}
