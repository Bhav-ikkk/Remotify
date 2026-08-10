/**
 * Build a master resume content object from CandidateProfile (+ relations).
 * Keeps tone human: short bullets, concrete metrics, no buzzword salad.
 * @param {object} profile
 * @param {{ job?: object }} [options]
 */
export function buildMasterResume(profile, options = {}) {
  const job = options.job || null;

  const skills = orderSkillsForJob(profile.skills || [], job);
  const projects = orderProjectsForJob(profile.projects || [], job).slice(0, 5);
  const experiences = profile.experiences || [];
  const education = profile.education || [];

  const summary = tailorSummary(profile, job);

  return {
    fullName: profile.fullName,
    headline: pickHeadline(profile, job),
    location: profile.location || "",
    email: profile.email || "",
    links: [
      profile.websiteUrl,
      profile.portfolioUrl && profile.portfolioUrl !== profile.websiteUrl
        ? profile.portfolioUrl
        : null,
      profile.githubUrl,
      profile.linkedinUrl,
    ].filter(Boolean),
    summary,
    skills,
    experiences: experiences.map((e) => ({
      company: e.company,
      title: e.title,
      location: e.location || "",
      tenure: formatTenure(e),
      bullets: (e.highlights || []).slice(0, 4),
      stack: e.stack || [],
    })),
    projects: projects.map((p) => ({
      name: p.name,
      tagline: p.tagline || "",
      impact: p.impact || "",
      bullets: (p.highlights || []).slice(0, 3),
      stack: (p.stack || []).slice(0, 8),
      liveUrl: p.liveUrl || "",
    })),
    education: education.map((ed) => ({
      institution: ed.institution,
      degree: [ed.degree, ed.field].filter(Boolean).join(" — "),
      years: [ed.startYear, ed.endYear].filter(Boolean).join("–"),
      notes: ed.notes || "",
    })),
    tailoredFor: job
      ? { title: job.title || "", company: job.company || "" }
      : null,
  };
}

/**
 * @param {object} profile
 * @param {object|null} job
 */
function tailorSummary(profile, job) {
  const base =
    profile.summary ||
    `${profile.fullName} — ${profile.headline || "Full-Stack Developer"}.`;

  if (!job) return compressSummary(base);

  const title = String(job.title || "").toLowerCase();
  const desc = `${job.title || ""} ${job.description || ""} ${(job.skills || []).join(" ")}`.toLowerCase();

  const hooks = [];
  if (/next\.?js|react|full.?stack|node/.test(desc)) {
    hooks.push(
      "Comfortable owning Next.js / React / Node features from UI through Postgres."
    );
  }
  if (/ai|llm|langchain|openai|gemini|agent/.test(desc)) {
    hooks.push(
      "Ships practical LLM features (agents, APIs, content pipelines) inside real products."
    );
  }
  if (/remote/.test(String(job.location || "").toLowerCase()) || /remote/.test(desc)) {
    hooks.push("Looking for remote-first product engineering roles.");
  }
  if (/senior|staff|lead/.test(title)) {
    // Stay honest — don't claim seniority beyond profile
    hooks.push(
      `About ${profile.yearsExperience ?? 1.5} years shipping production web apps with strong end-to-end ownership.`
    );
  }

  const core = compressSummary(base);
  if (hooks.length === 0) return core;
  return `${core} ${hooks[0]}`;
}

/**
 * @param {object} profile
 * @param {object|null} job
 */
function pickHeadline(profile, job) {
  if (!job?.title) return profile.headline || "Full-Stack Developer";
  const desc = `${job.title} ${(job.skills || []).join(" ")}`.toLowerCase();
  if (/ai|llm|agent/.test(desc)) {
    return "Full-Stack Developer · AI-assisted products";
  }
  if (/front.?end|react/.test(desc) && !/full.?stack|node|backend/.test(desc)) {
    return "Frontend / Full-Stack Developer · React · Next.js";
  }
  return profile.headline || "Full-Stack Developer · Next.js · Postgres";
}

/**
 * @param {Array<object>} skills
 * @param {object|null} job
 */
function orderSkillsForJob(skills, job) {
  if (!job) {
    return skills.map((s) => s.name);
  }
  const blob = `${job.title || ""} ${job.description || ""} ${(job.skills || []).join(" ")}`.toLowerCase();
  const scored = skills.map((s) => {
    const name = String(s.name);
    const hit =
      blob.includes(name.toLowerCase()) ||
      (s.keywords || []).some((k) => blob.includes(String(k).toLowerCase()));
    return { name, hit, proficiency: s.proficiency };
  });
  scored.sort((a, b) => Number(b.hit) - Number(a.hit));
  return scored.map((s) => s.name);
}

/**
 * @param {Array<object>} projects
 * @param {object|null} job
 */
function orderProjectsForJob(projects, job) {
  const featured = [...projects].sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return (a.sortOrder || 0) - (b.sortOrder || 0);
  });
  if (!job) return featured;

  const blob = `${job.title || ""} ${job.description || ""} ${(job.skills || []).join(" ")}`.toLowerCase();
  return featured.sort((a, b) => {
    const sa = scoreProject(a, blob);
    const sb = scoreProject(b, blob);
    return sb - sa;
  });
}

function scoreProject(project, blob) {
  let score = project.featured ? 2 : 0;
  for (const tech of project.stack || []) {
    if (blob.includes(String(tech).toLowerCase())) score += 3;
  }
  if (blob.includes(String(project.name || "").toLowerCase())) score += 1;
  return score;
}

function compressSummary(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 520);
}

function formatTenure(experience) {
  const start = experience.startDate
    ? new Date(experience.startDate).getFullYear()
    : null;
  const end = experience.isCurrent
    ? "Present"
    : experience.endDate
      ? new Date(experience.endDate).getFullYear()
      : null;
  if (!start && !end) return "";
  if (start && end) return `${start} – ${end}`;
  return String(start || end);
}
