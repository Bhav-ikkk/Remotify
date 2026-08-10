import { prisma } from "./database.js";
import { getSetting, SETTING_KEYS } from "./settings.js";

const profileInclude = {
  skills: { orderBy: [{ category: "asc" }, { name: "asc" }] },
  projects: { orderBy: [{ featured: "desc" }, { sortOrder: "asc" }] },
  experiences: { orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }] },
  education: { orderBy: { startYear: "desc" } },
  priorities: { orderBy: { weight: "desc" } },
  sources: { orderBy: { scrapedAt: "desc" } },
};

/**
 * Active candidate profile with relations, or null.
 */
export async function getActiveProfile() {
  return prisma.candidateProfile.findFirst({
    where: { isActive: true },
    include: profileInclude,
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Build the text blob Gemini uses for job scoring.
 * Prefers structured DB profile; falls back to settings TARGET_PROFILE.
 * @param {{ maxChars?: number }} [options]
 * @returns {Promise<string>}
 */
export async function buildAiMatchProfile(options = {}) {
  const maxChars =
    typeof options.maxChars === "number" && options.maxChars > 500
      ? options.maxChars
      : 12000;

  const profile = await getActiveProfile();
  if (!profile) {
    return readLegacyTargetProfile();
  }

  const text = formatProfileForAi(profile);
  if (text.trim().length < 80) {
    return readLegacyTargetProfile();
  }

  return text.length > maxChars ? `${text.slice(0, maxChars)}\n…` : text;
}

/**
 * @returns {Promise<string>}
 */
async function readLegacyTargetProfile() {
  const value = await getSetting(SETTING_KEYS.TARGET_PROFILE);
  if (typeof value === "string" && value.trim()) return value.trim();
  return "Remote-friendly software engineer seeking full-stack JavaScript roles.";
}

/**
 * Compact, high-signal candidate brief for the recruiter model.
 * @param {object} profile
 */
export function formatProfileForAi(profile) {
  const lines = [];

  lines.push(`Name: ${profile.fullName}`);
  if (profile.headline) lines.push(`Headline: ${profile.headline}`);
  if (profile.location) lines.push(`Location: ${profile.location}`);
  if (profile.yearsExperience != null) {
    lines.push(`Years of experience: ${profile.yearsExperience}`);
  }
  if (profile.availability) lines.push(`Availability: ${profile.availability}`);
  if (profile.workAuth?.length) {
    lines.push(`Work auth / geo: ${profile.workAuth.join("; ")}`);
  }

  if (profile.summary) {
    lines.push("", "Summary:", profile.summary);
  }

  if (profile.targetRoles?.length) {
    lines.push("", `Target roles: ${profile.targetRoles.join(", ")}`);
  }
  if (profile.targetCompanies?.length) {
    lines.push(`Target company types: ${profile.targetCompanies.join(", ")}`);
  }
  if (profile.avoidRoles?.length) {
    lines.push(`Avoid / weak fit: ${profile.avoidRoles.join("; ")}`);
  }

  if (profile.priorities?.length) {
    lines.push("", "Priorities (higher weight = more important):");
    for (const p of profile.priorities) {
      const note = p.notes ? ` — ${p.notes}` : "";
      lines.push(`- [${p.weight}] ${p.label}${note}`);
    }
  }

  if (profile.skills?.length) {
    lines.push("", "Skills:");
    for (const s of profile.skills) {
      const meta = [
        s.proficiency,
        s.years != null ? `${s.years}y` : null,
        s.category,
      ]
        .filter(Boolean)
        .join(", ");
      const kw = s.keywords?.length ? ` (${s.keywords.join(", ")})` : "";
      lines.push(`- ${s.name}${meta ? ` [${meta}]` : ""}${kw}`);
    }
  }

  if (profile.experiences?.length) {
    lines.push("", "Experience:");
    for (const e of profile.experiences) {
      const when = formatTenure(e);
      lines.push(`- ${e.title} @ ${e.company}${when ? ` (${when})` : ""}`);
      if (e.description) lines.push(`  ${e.description}`);
      for (const h of e.highlights || []) lines.push(`  • ${h}`);
      if (e.stack?.length) lines.push(`  Stack: ${e.stack.join(", ")}`);
    }
  }

  const projects = (profile.projects || []).filter(
    (p) => p.featured || p.sortOrder <= 10
  );
  if (projects.length) {
    lines.push("", "Key projects (evidence of skills):");
    for (const p of projects.slice(0, 10)) {
      lines.push(`- ${p.name}${p.tagline ? ` — ${p.tagline}` : ""}`);
      if (p.impact) lines.push(`  Impact: ${p.impact}`);
      if (p.stack?.length) lines.push(`  Stack: ${p.stack.join(", ")}`);
      for (const h of (p.highlights || []).slice(0, 3)) {
        lines.push(`  • ${h}`);
      }
    }
  }

  if (profile.education?.length) {
    lines.push("", "Education:");
    for (const ed of profile.education) {
      const years =
        ed.startYear || ed.endYear
          ? ` (${[ed.startYear, ed.endYear].filter(Boolean).join("–")})`
          : "";
      lines.push(
        `- ${[ed.degree, ed.field].filter(Boolean).join(" — ")} @ ${ed.institution}${years}`
      );
      if (ed.notes) lines.push(`  ${ed.notes}`);
    }
  }

  const master = profile.masterResume;
  if (master && typeof master === "object") {
    const notes = Array.isArray(master.positioningNotes)
      ? master.positioningNotes
      : [];
    if (notes.length) {
      lines.push("", "Positioning for match scoring:");
      for (const n of notes) lines.push(`- ${n}`);
    }
  }

  const links = [
    profile.websiteUrl && `Website: ${profile.websiteUrl}`,
    profile.portfolioUrl && `Portfolio: ${profile.portfolioUrl}`,
    profile.githubUrl && `GitHub: ${profile.githubUrl}`,
    profile.linkedinUrl && `LinkedIn: ${profile.linkedinUrl}`,
  ].filter(Boolean);
  if (links.length) {
    lines.push("", "Links:", ...links.map((l) => `- ${l}`));
  }

  return lines.join("\n");
}

/**
 * @param {object} experience
 */
function formatTenure(experience) {
  const start = experience.startDate
    ? new Date(experience.startDate).getFullYear()
    : null;
  const end = experience.isCurrent
    ? "present"
    : experience.endDate
      ? new Date(experience.endDate).getFullYear()
      : null;
  if (!start && !end) return "";
  if (start && end) return `${start}–${end}`;
  return String(start || end);
}

/**
 * Lightweight summary for dashboard / API.
 */
export async function getProfileSummary() {
  const profile = await getActiveProfile();
  if (!profile) {
    return { configured: false, profile: null };
  }

  return {
    configured: true,
    profile: {
      id: profile.id,
      slug: profile.slug,
      fullName: profile.fullName,
      headline: profile.headline,
      location: profile.location,
      yearsExperience: profile.yearsExperience,
      targetRoles: profile.targetRoles,
      skillCount: profile.skills.length,
      projectCount: profile.projects.length,
      priorityCount: profile.priorities.length,
      topPriorities: profile.priorities.slice(0, 5).map((p) => ({
        key: p.key,
        label: p.label,
        weight: p.weight,
      })),
      featuredProjects: profile.projects
        .filter((p) => p.featured)
        .slice(0, 6)
        .map((p) => ({
          name: p.name,
          tagline: p.tagline,
          liveUrl: p.liveUrl,
          stack: p.stack,
        })),
    },
  };
}
