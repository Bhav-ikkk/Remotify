import { prisma } from "../database.js";
import { loadMasterResumeJson } from "../resume/template.js";

/**
 * Ensure an active ApplicationIdentity exists, seeded from locked master resume.
 */
export async function ensureApplicationIdentity() {
  const existing = await prisma.applicationIdentity.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) return existing;

  let seed = {
    fullName: "Applicant",
    email: "applicant@example.com",
    phone: null,
    location: null,
    linkedinUrl: null,
    githubUrl: null,
    portfolioUrl: null,
    workAuthNotes: "India-based · open to remote worldwide",
    requiresSponsorship: false,
    remoteOk: true,
    relocateOk: false,
    salaryExpectation: null,
    noticePeriod: "Immediate / 15 days",
    coverLetterBlurb:
      "Full-stack developer shipping production Next.js and PostgreSQL products, including GenAI-assisted systems.",
  };

  try {
    const { data } = loadMasterResumeJson();
    const c = data.contact || {};
    seed = {
      fullName: data.displayName || data.fullName || seed.fullName,
      email: c.email || seed.email,
      phone: c.phone || null,
      location: c.location || null,
      linkedinUrl: c.linkedinUrl || null,
      githubUrl: c.githubUrl || null,
      portfolioUrl: c.portfolioUrl || null,
      workAuthNotes: "India-based · open to remote worldwide",
      requiresSponsorship: false,
      remoteOk: true,
      relocateOk: false,
      salaryExpectation: null,
      noticePeriod: "Immediate / 15 days",
      coverLetterBlurb: String(data.summary || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 600),
    };
  } catch (error) {
    console.warn(
      "[apply:identity] master resume unavailable, using fallback:",
      error instanceof Error ? error.message : error
    );
  }

  return prisma.applicationIdentity.upsert({
    where: { slug: "default" },
    create: { slug: "default", isActive: true, ...seed },
    update: { isActive: true, ...seed },
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
