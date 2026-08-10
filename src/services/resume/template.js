import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../../..");

/**
 * Load locked master resume JSON (personal preferred, demo fallback).
 * This is the source of truth for PDF wording/structure.
 */
export function loadMasterResumeJson() {
  const personal = resolve(root, "data/master-resume.personal.json");
  const demo = resolve(root, "data/master-resume.demo.json");
  const forceDemo = process.env.RESUME_DEMO === "1";
  const path = !forceDemo && existsSync(personal) ? personal : demo;
  if (!existsSync(path)) {
    throw new Error(`Master resume JSON missing at ${path}`);
  }
  return { path, data: JSON.parse(readFileSync(path, "utf8")) };
}

/**
 * Canonical master resume document for rendering + AI tailor.
 * Prefers locked JSON from your ATS PDF; falls back to CandidateProfile.
 *
 * @param {object} [profile]
 */
export function buildMasterResumeDocument(profile) {
  try {
    const { data } = loadMasterResumeJson();
    return fromLockedJson(data);
  } catch {
    return fromProfile(profile || {});
  }
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
