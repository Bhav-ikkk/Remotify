import { JobSchema } from "../scrapers/schema.js";

/** Core title buckets keyed by matcher predicates (order matters). */
const TITLE_RULES = [
  {
    bucket: "Full Stack Engineer",
    patterns: [/\bfull[\s-]?stack\b/i, /\bfullstack\b/i],
  },
  {
    bucket: "Mobile Engineer",
    patterns: [
      /\bmobile\b/i,
      /\bios\b/i,
      /\bandroid\b/i,
      /\breact\s*native\b/i,
      /\bflutter\b/i,
    ],
  },
  {
    bucket: "DevOps Engineer",
    patterns: [
      /\bdevops\b/i,
      /\bsite reliability\b/i,
      /\bsre\b/i,
      /\bplatform engineer\b/i,
      /\binfrastructure engineer\b/i,
    ],
  },
  {
    bucket: "Data Engineer",
    patterns: [
      /\bdata engineer\b/i,
      /\bmachine learning\b/i,
      /\bml engineer\b/i,
      /\bai engineer\b/i,
      /\bdata scientist\b/i,
    ],
  },
  {
    bucket: "Frontend Engineer",
    patterns: [
      /\bfront[\s-]?end\b/i,
      /\bfrontend\b/i,
      /\bui engineer\b/i,
      /\bui developer\b/i,
      /\breact(\.?js)?\s*(developer|engineer)\b/i,
      /\bvue(\.?js)?\s*(developer|engineer)\b/i,
      /\bangular\s*(developer|engineer)\b/i,
    ],
  },
  {
    bucket: "Backend Engineer",
    patterns: [
      /\bback[\s-]?end\b/i,
      /\bbackend\b/i,
      /\bnode(\.?js)?\s*(developer|engineer)\b/i,
      /\bjava\s*(developer|engineer)\b/i,
      /\bpython\s*(developer|engineer)\b/i,
      /\bgolang\s*(developer|engineer)\b/i,
      /\bgo\s*(developer|engineer)\b/i,
      /\bruby\s*(developer|engineer)\b/i,
      /\b\.?net\s*(developer|engineer)\b/i,
      /\bapi\s*(developer|engineer)\b/i,
      /\bserver[\s-]?side\b/i,
    ],
  },
];
/** Raw skill token → canonical label. */
const SKILL_MAP = {
  nodejs: "Node.js",
  "node.js": "Node.js",
  node: "Node.js",
  javascript: "JavaScript",
  js: "JavaScript",
  typescript: "TypeScript",
  ts: "TypeScript",
  reactjs: "React",
  "react.js": "React",
  react: "React",
  vuejs: "Vue.js",
  "vue.js": "Vue.js",
  vue: "Vue.js",
  angularjs: "Angular",
  angular: "Angular",
  nextjs: "Next.js",
  "next.js": "Next.js",
  next: "Next.js",
  expressjs: "Express",
  express: "Express",
  postgresql: "PostgreSQL",
  postgres: "PostgreSQL",
  psql: "PostgreSQL",
  mongodb: "MongoDB",
  mongo: "MongoDB",
  aws: "AWS",
  gcp: "GCP",
  "google cloud": "GCP",
  azure: "Azure",
  docker: "Docker",
  kubernetes: "Kubernetes",
  k8s: "Kubernetes",
  graphql: "GraphQL",
  html: "HTML",
  css: "CSS",
  python: "Python",
  java: "Java",
  golang: "Go",
  go: "Go",
  csharp: "C#",
  "c#": "C#",
  "c++": "C++",
  ruby: "Ruby",
  rails: "Ruby on Rails",
  "ruby on rails": "Ruby on Rails",
  php: "PHP",
  laravel: "Laravel",
  django: "Django",
  flask: "Flask",
  spring: "Spring",
  "spring boot": "Spring Boot",
  redis: "Redis",
  elasticsearch: "Elasticsearch",
  kafka: "Kafka",
  terraform: "Terraform",
  linux: "Linux",
  git: "Git",
  github: "GitHub",
  prisma: "Prisma",
  tailwind: "Tailwind CSS",
  "tailwindcss": "Tailwind CSS",
  "tailwind css": "Tailwind CSS",
};

/**
 * Normalize a job title into a core role bucket when a rule matches.
 * @param {string} title
 * @returns {string}
 */
export function normalizeTitle(title) {
  const raw = String(title || "").trim();
  if (!raw) return raw;

  for (const rule of TITLE_RULES) {
    if (rule.patterns.some((re) => re.test(raw))) {
      return rule.bucket;
    }
  }

  return raw.replace(/\s+/g, " ").trim();
}

/**
 * Normalize a single skill token.
 * @param {string} skill
 * @returns {string}
 */
export function normalizeSkill(skill) {
  const raw = String(skill || "").trim();
  if (!raw) return "";

  const key = raw.toLowerCase().replace(/\s+/g, " ").trim();
  if (SKILL_MAP[key]) return SKILL_MAP[key];

  // Preserve known casing patterns like Node.js / C#
  if (/^[a-z0-9.+#\s-]+$/i.test(raw)) {
    return raw
      .split(/[\s/|,]+/)
      .filter(Boolean)
      .map((part) => {
        const mapped = SKILL_MAP[part.toLowerCase()];
        if (mapped) return mapped;
        if (part.includes(".")) return part;
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(" ");
  }

  return raw;
}

/**
 * Normalize a list of skills with dedupe (case-insensitive).
 * @param {string[]} skills
 * @returns {string[]}
 */
export function normalizeSkills(skills) {
  const list = Array.isArray(skills) ? skills : [];
  const out = [];
  const seen = new Set();

  for (const skill of list) {
    const normalized = normalizeSkill(skill);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }

  return out;
}

/**
 * Normalize remote / geographic location labels.
 * @param {string} location
 * @returns {string}
 */
export function normalizeLocation(location) {
  const raw = String(location || "").trim();
  if (!raw) return "Worldwide Remote";

  const compact = raw.toLowerCase().replace(/\s+/g, " ").trim();

  if (
    /\b(worldwide|anywhere|global|earth|work from anywhere)\b/.test(compact) ||
    /^remote\s*[-–—]?\s*(global|worldwide)?$/.test(compact) ||
    compact === "remote"
  ) {
    // Prefer USA Remote when US is also mentioned
    if (/\b(usa|u\.s\.a\.?|united states|us-only|us only)\b/.test(compact)) {
      return "USA Remote";
    }
    return "Worldwide Remote";
  }

  if (
    /\b(usa|u\.s\.a\.?|united states)\b/.test(compact) ||
    /\bus\s*remote\b/.test(compact) ||
    /\bremote\s*[-–—]?\s*us\b/.test(compact) ||
    /\bunited states\s*\(?\s*remote\s*\)?/.test(compact) ||
    /\bremote\s*\(?\s*us(a)?\s*\)?/.test(compact)
  ) {
    return "USA Remote";
  }

  if (/\b(uk|united kingdom|britain)\b/.test(compact) && /\bremote\b/.test(compact)) {
    return "UK Remote";
  }

  if (/\beu\b|\beurope\b/.test(compact) && /\bremote\b/.test(compact)) {
    return "EU Remote";
  }

  if (/\bremote\b/.test(compact)) {
    return raw.replace(/\s+/g, " ").trim();
  }

  return raw.replace(/\s+/g, " ").trim();
}

/**
 * Normalize a scraped job payload into a clean JobSchema object.
 * Pure transformation — does not mutate the input.
 * @param {object} job
 */
export function normalizeJob(job) {
  const source = job && typeof job === "object" ? job : {};

  const normalized = {
    title: normalizeTitle(source.title),
    company: String(source.company || "Unknown Company").replace(/\s+/g, " ").trim(),
    location: normalizeLocation(source.location),
    salary: source.salary == null ? null : String(source.salary),
    currency: source.currency == null ? null : String(source.currency),
    employmentType:
      source.employmentType == null ? null : String(source.employmentType),
    experience: source.experience == null ? null : String(source.experience),
    description: String(source.description || "").trim(),
    skills: normalizeSkills(source.skills),
    applyUrl: String(source.applyUrl || ""),
    companyUrl: source.companyUrl == null ? null : String(source.companyUrl),
    sourceWebsite: String(source.sourceWebsite || "unknown"),
    postedDate:
      source.postedDate instanceof Date
        ? source.postedDate
        : source.postedDate
          ? new Date(source.postedDate)
          : null,
    scrapedAt:
      source.scrapedAt instanceof Date
        ? source.scrapedAt
        : source.scrapedAt
          ? new Date(source.scrapedAt)
          : new Date(),
  };

  if (normalized.postedDate && Number.isNaN(normalized.postedDate.getTime())) {
    normalized.postedDate = null;
  }

  return JobSchema.parse(normalized);
}
