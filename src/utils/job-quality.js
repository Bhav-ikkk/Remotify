import { canAutoSubmit, detectAtsType } from "../services/apply/ats.js";

/** Default title tokens that look like software IC roles we want. */
export const DEFAULT_TITLE_ALLOW = [
  "software",
  "engineer",
  "developer",
  "fullstack",
  "full-stack",
  "full stack",
  "backend",
  "front-end",
  "frontend",
  "front end",
  "full stack",
  "sde",
  "swe",
  "web developer",
  "application engineer",
  "platform engineer",
  "node",
  "react",
  "typescript",
  "javascript",
];

/** Titles we skip by default (seniority / people-manager track). */
export const DEFAULT_TITLE_BLOCK = [
  "principal",
  "staff engineer",
  "staff software",
  "director",
  "vp ",
  "vice president",
  "head of",
  "manager",
  "management",
  "chief",
  "cto",
  "cpo",
  "intern",
  "internship",
  "student",
  "phd",
];

/**
 * @param {string} title
 * @param {{ allow?: string[], block?: string[] }} [opts]
 */
export function titlePassesQualityFilter(title, opts = {}) {
  const t = String(title || "").toLowerCase().trim();
  if (!t) return false;

  const allow = opts.allow || DEFAULT_TITLE_ALLOW;
  const block = opts.block || DEFAULT_TITLE_BLOCK;

  if (block.some((b) => t.includes(String(b).toLowerCase()))) return false;
  return allow.some((a) => t.includes(String(a).toLowerCase()));
}

/**
 * Prefer remote / worldwide / India-friendly locations. Reject clear onsite-only.
 * @param {string} location
 */
export function locationPassesRemoteFilter(location) {
  const loc = String(location || "").toLowerCase().trim();
  if (!loc) return true;
  if (/onsite only|on-site only|in[- ]office only|must relocate/.test(loc)) {
    return false;
  }
  if (
    /remote|worldwide|anywhere|work from home|wfh|distributed|hybrid/.test(loc)
  ) {
    return true;
  }
  // India-friendly explicit locations
  if (/\bindia\b|\bist\b|bangalore|bengaluru|hyderabad|pune|mumbai|delhi|noida|gurgaon|gurugram/.test(loc)) {
    return true;
  }
  // Soft allow when location is a country/city without "onsite" — many ATS boards use city + remote in description
  return true;
}

/**
 * Rank key for scoring budget: auto-ATS first, then higher structural fit.
 * Higher = score sooner.
 * @param {{ title?: string, location?: string, applyUrl?: string }} job
 */
export function qualityRankScore(job) {
  let score = 0;
  const ats = detectAtsType(job?.applyUrl);
  if (canAutoSubmit(ats)) score += 100;
  if (titlePassesQualityFilter(job?.title)) score += 40;
  const loc = String(job?.location || "").toLowerCase();
  if (/remote|worldwide|anywhere/.test(loc)) score += 20;
  if (/\bindia\b|\bist\b/.test(loc)) score += 10;
  return score;
}

/**
 * Filter + sort jobs before Gemini to raise lead quality and save cron budget.
 * @param {Array<object>} jobs
 * @param {{ requireTitleMatch?: boolean, requireRemote?: boolean }} [opts]
 */
export function prefilterJobsForScoring(jobs, opts = {}) {
  const requireTitleMatch = opts.requireTitleMatch !== false;
  const requireRemote = opts.requireRemote === true;
  const list = Array.isArray(jobs) ? jobs : [];

  const filtered = list.filter((job) => {
    if (requireTitleMatch && !titlePassesQualityFilter(job?.title)) return false;
    if (requireRemote && !locationPassesRemoteFilter(job?.location)) return false;
    if (!requireRemote && !locationPassesRemoteFilter(job?.location)) return false;
    return true;
  });

  return filtered.sort((a, b) => qualityRankScore(b) - qualityRankScore(a));
}
