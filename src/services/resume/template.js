import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../database.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../../..");

/**
 * Load the locked master resume document.
 *
 * Source of truth is the active CandidateProfile.masterResume column in
 * Postgres (works on Vercel and the local worker alike — no local files).
 * The only exception is the explicit RESUME_DEMO=1 escape hatch, which reads
 * the committed demo file for open-source demos and is loudly logged.
 *
 * Fails loudly with an actionable error when no active CandidateProfile with
 * a complete master resume exists. Never silently substitutes demo data.
 *
 * @returns {Promise<{ source: "db" | "demo-file", profile: object | null, data: object }>}
 */
export async function loadMasterResume() {
  if (process.env.RESUME_DEMO === "1") {
    const demoPath = resolve(root, "data/master-resume.demo.json");
    if (!existsSync(demoPath)) {
      throw new Error(`RESUME_DEMO=1 set but demo resume missing at ${demoPath}`);
    }
    console.warn(
      "[resume:template] RESUME_DEMO=1 — using demo master resume file. Never use this for real applications."
    );
    return {
      source: "demo-file",
      profile: null,
      data: JSON.parse(readFileSync(demoPath, "utf8")),
    };
  }

  const profile = await prisma.candidateProfile.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  if (!profile) {
    throw new Error(
      "No active CandidateProfile in the database. Seed one with `npm run profile:seed`, then import your locked master resume with `npm run resume:sync`."
    );
  }

  const data = profile.masterResume;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(
      `CandidateProfile "${profile.slug}" has no masterResume document. Import your locked master resume into the database with \`npm run resume:sync\` (reads data/master-resume.personal.json).`
    );
  }

  const missing = validateMasterResumeDocument(data);
  if (missing.length > 0) {
    throw new Error(
      `masterResume on CandidateProfile "${profile.slug}" is incomplete (missing: ${missing.join(", ")}). Fix the source JSON and re-run \`npm run resume:sync\`.`
    );
  }

  return { source: "db", profile, data };
}

/**
 * Check a master resume document has everything a real application needs.
 * @param {object} data
 * @returns {string[]} Human-readable list of missing pieces (empty = complete)
 */
export function validateMasterResumeDocument(data) {
  const missing = [];
  if (!data || typeof data !== "object") return ["entire document"];

  if (!String(data.fullName || data.displayName || "").trim()) {
    missing.push("fullName");
  }
  const contact = data.contact || {};
  if (!String(contact.email || "").trim()) missing.push("contact.email");
  if (!String(data.summary || "").trim()) missing.push("summary");

  const skillCount = Object.values(data.skills || {})
    .flat()
    .filter(Boolean).length;
  if (skillCount === 0) missing.push("skills");

  const hasExperience = Array.isArray(data.experience) && data.experience.length > 0;
  const hasProjects = Array.isArray(data.projects) && data.projects.length > 0;
  if (!hasExperience && !hasProjects) missing.push("experience or projects");

  return missing;
}

/**
 * Canonical master resume document for rendering + AI tailor.
 *
 * Reads the locked master resume from the DB CandidateProfile. When no
 * locked document exists, a full CandidateProfile (with skills/experiences/
 * projects relations) may be rendered directly; anything less throws so a
 * placeholder resume can never represent a real application.
 *
 * @param {object} [profile]
 */
export async function buildMasterResumeDocument(profile) {
  try {
    const { data } = await loadMasterResume();
    return fromLockedJson(data);
  } catch (error) {
    if (isRenderableProfile(profile)) {
      console.warn(
        "[resume:template] locked master resume unavailable, rendering from CandidateProfile relations:",
        error instanceof Error ? error.message : error
      );
      return fromProfile(profile);
    }
    throw error;
  }
}

/**
 * A profile is renderable only if it carries real resume content —
 * a bare stub (name only) must never turn into a near-empty PDF.
 * @param {object} profile
 */
function isRenderableProfile(profile) {
  if (!profile || typeof profile !== "object") return false;
  if (!String(profile.fullName || "").trim()) return false;
  const hasSkills = Array.isArray(profile.skills) && profile.skills.length > 0;
  const hasExperiences =
    Array.isArray(profile.experiences) && profile.experiences.length > 0;
  const hasProjects = Array.isArray(profile.projects) && profile.projects.length > 0;
  return hasSkills || hasExperiences || hasProjects;
}

/**
 * @param {object} data
 */
function fromLockedJson(data) {
  const contact = data.contact || {};
  return {
    locked: true,
    fullName: data.displayName || data.fullName || "",
    fullNameHeader: data.fullName || String(data.displayName || "").toUpperCase(),
    headline: data.headline || "Full-Stack Developer",
    summary: String(data.summary || "").trim(),
    yearsExperience: data.yearsExperience ?? 1.5,
    contact: {
      location: contact.location || "",
      phone: contact.phone || "",
      email: contact.email || "",
      portfolio: contact.portfolio || "",
      portfolioUrl: contact.portfolioUrl || "",
      github: contact.github || "",
      githubUrl: contact.githubUrl || "",
      linkedin: contact.linkedin || "",
      linkedinUrl: contact.linkedinUrl || "",
    },
    skillsByCategory: data.skills || {},
    skills: flattenSkills(data.skills || {}),
    experiences: (data.experience || []).map((e) => ({
      title: e.title,
      company: e.company,
      tenure: e.tenure || "",
      location: e.location || "",
      bullets: [...(e.bullets || [])],
      stack: e.stack || [],
    })),
    projects: (data.projects || []).map((p) => ({
      name: p.name,
      year: p.year || "",
      tagline: "",
      impact: "",
      bullets: [...(p.bullets || [])],
      stack: [...(p.stack || [])],
      liveUrl: p.liveUrl || "",
      featured: true,
    })),
    education: (data.education || []).map((ed) => ({
      degree: ed.degree || "",
      institution: ed.institution || "",
      years: ed.years || "",
      notes: ed.notes || "",
    })),
    achievements: [...(data.achievements || [])],
    positioningNotes: [],
    stretchRules: {
      allowed: [
        "Reorder projects and skill lines to match the job",
        "Lightly rephrase summary/bullets using the same facts and metrics",
        "Emphasize stacks already listed on the master resume",
      ],
      forbidden: [
        "Do not invent employers, schools, packages, metrics, or clients",
        "Do not add years of experience beyond the master resume",
        "Do not invent new skill names not already listed",
      ],
    },
  };
}

/**
 * @param {object} profile
 */
function fromProfile(profile) {
  const skillsByCategory = groupSkills(profile.skills || []);
  return {
    locked: false,
    fullName: profile.fullName || "",
    fullNameHeader: String(profile.fullName || "").toUpperCase(),
    headline: profile.headline || "Full-Stack Developer",
    summary: String(profile.summary || "").trim(),
    yearsExperience: profile.yearsExperience ?? null,
    contact: {
      location: cleanLocation(profile.location),
      phone: profile.phone || "",
      email: profile.email || "",
      portfolio: stripHost(profile.portfolioUrl || profile.websiteUrl),
      portfolioUrl: profile.portfolioUrl || profile.websiteUrl || "",
      github: stripHost(profile.githubUrl).replace(/^github\.com\//i, ""),
      githubUrl: profile.githubUrl || "",
      linkedin: stripHost(profile.linkedinUrl).replace(/^.*linkedin\.com\/in\//i, ""),
      linkedinUrl: profile.linkedinUrl || "",
    },
    skillsByCategory,
    skills: flattenSkills(skillsByCategory),
    experiences: (profile.experiences || []).map((e) => ({
      company: e.company,
      title: e.title,
      location: e.location || "",
      tenure: formatTenure(e),
      bullets: (e.highlights || []).map(String).filter(Boolean),
      stack: e.stack || [],
    })),
    projects: [...(profile.projects || [])]
      .sort((a, b) => {
        if (Boolean(a.featured) !== Boolean(b.featured)) return a.featured ? -1 : 1;
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      })
      .map((p) => ({
        name: p.name,
        year: "",
        tagline: p.tagline || "",
        impact: p.impact || "",
        bullets: [
          ...(p.impact ? [p.impact] : []),
          ...(p.highlights || []),
        ]
          .map(String)
          .filter(Boolean)
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .slice(0, 4),
        stack: (p.stack || []).slice(0, 10),
        liveUrl: p.liveUrl || "",
        featured: Boolean(p.featured),
      })),
    education: (profile.education || []).map((ed) => ({
      institution: ed.institution,
      degree: [ed.degree, ed.field].filter(Boolean).join(", "),
      years: [ed.startYear, ed.endYear].filter(Boolean).join(" – "),
      notes: ed.notes || "",
    })),
    achievements: [],
    positioningNotes:
      profile.masterResume &&
      typeof profile.masterResume === "object" &&
      Array.isArray(profile.masterResume.positioningNotes)
        ? profile.masterResume.positioningNotes
        : [],
    stretchRules:
      profile.masterResume &&
      typeof profile.masterResume === "object" &&
      profile.masterResume.stretchRules
        ? profile.masterResume.stretchRules
        : {
            allowed: ["Reorder bullets and skills to match the job"],
            forbidden: ["Do not invent employers, degrees, or metrics"],
          },
  };
}

function flattenSkills(skillsByCategory) {
  return Object.values(skillsByCategory || {})
    .flat()
    .map(String)
    .filter(Boolean);
}

function groupSkills(skills) {
  /** @type {Record<string, string[]>} */
  const buckets = {
    Languages: [],
    Frontend: [],
    Backend: [],
    "AI / ML": [],
    Enterprise: [],
    Tools: [],
    Other: [],
  };

  for (const skill of skills) {
    const name = String(skill.name || "").trim();
    if (!name) continue;
    const cat = String(skill.category || "other").toLowerCase();
    if (cat === "language") buckets.Languages.push(name);
    else if (cat === "frontend") buckets.Frontend.push(name);
    else if (cat === "backend" || cat === "database") buckets.Backend.push(name);
    else if (cat === "ai" || cat === "media") buckets["AI / ML"].push(name);
    else if (cat === "integrations" || cat === "devops" || cat === "automation") {
      buckets.Tools.push(name);
    } else buckets.Other.push(name);
  }

  /** @type {Record<string, string[]>} */
  const cleaned = {};
  for (const [key, values] of Object.entries(buckets)) {
    if (values.length) cleaned[key] = [...new Set(values)];
  }
  return cleaned;
}

function cleanLocation(location) {
  return String(location || "")
    .replace(/\s*·\s*Open to Remote Worldwide/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHost(url) {
  return String(url || "")
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");
}

function formatTenure(experience) {
  const start = experience.startDate
    ? formatMonthYear(experience.startDate)
    : null;
  const end = experience.isCurrent
    ? "Present"
    : experience.endDate
      ? formatMonthYear(experience.endDate)
      : null;
  if (!start && !end) return "";
  if (start && end) return `${start} – ${end}`;
  return String(start || end);
}

function formatMonthYear(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}
