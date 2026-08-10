import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { http, stripHtml } from "./http.js";
import { ScraperOutputSchema } from "./schema.js";
import { titlePassesQualityFilter } from "../utils/job-quality.js";

const SOURCE = "ats-boards";
const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONFIG_PATH = join(
  __dirname,
  "../../data/target-companies.json"
);

/**
 * Load company board list from data/target-companies.json.
 * @param {string} [configPath]
 */
export function loadTargetCompanies(configPath = DEFAULT_CONFIG_PATH) {
  try {
    const raw = JSON.parse(readFileSync(configPath, "utf8"));
    return Array.isArray(raw?.companies) ? raw.companies : [];
  } catch (error) {
    console.error(
      "[scraper:ats-boards] config load failed:",
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

/**
 * Fetch public Greenhouse / Lever / Ashby job boards for configured companies.
 * @returns {Promise<import('zod').infer<typeof ScraperOutputSchema>>}
 */
export async function scrape() {
  const companies = loadTargetCompanies();
  const scrapedAt = new Date();
  const jobs = [];

  for (const company of companies) {
    const ats = String(company.ats || "").toLowerCase();
    const slug = String(company.slug || "").trim();
    const name = String(company.name || slug || "Unknown").trim();
    if (!slug) continue;

    try {
      if (ats === "greenhouse") {
        jobs.push(...(await fetchGreenhouse(slug, name, scrapedAt)));
      } else if (ats === "lever") {
        jobs.push(...(await fetchLever(slug, name, scrapedAt)));
      } else if (ats === "ashby") {
        jobs.push(...(await fetchAshby(slug, name, scrapedAt)));
      }
    } catch (error) {
      console.warn(
        `[scraper:ats-boards] ${ats}/${slug}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  try {
    return ScraperOutputSchema.parse(
      dedupeByUrl(jobs.filter((j) => titlePassesQualityFilter(j.title)))
    );
  } catch (error) {
    console.error(
      "[scraper:ats-boards] schema:",
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

/**
 * @param {string} slug
 * @param {string} companyName
 * @param {Date} scrapedAt
 */
async function fetchGreenhouse(slug, companyName, scrapedAt) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`;
  const { data } = await http.get(url);
  const list = Array.isArray(data?.jobs) ? data.jobs : [];
  const out = [];

  for (const item of list) {
    const title = String(item.title || "").trim();
    // Prefer Greenhouse-hosted apply URL so Playwright adapters can fill forms
    const applyUrl = item.id
      ? `https://boards.greenhouse.io/${slug}/jobs/${item.id}`
      : String(item.absolute_url || "").trim();
    if (!title || !applyUrl) continue;

    let postedDate = null;
    if (item.updated_at) {
      const parsed = new Date(item.updated_at);
      if (!Number.isNaN(parsed.getTime())) postedDate = parsed;
    }

    const location = String(item.location?.name || "Remote").trim() || "Remote";
    const description =
      stripHtml(String(item.content || "")) ||
      `${title} at ${companyName} — Greenhouse board.`;

    out.push({
      title,
      company: companyName,
      location,
      salary: null,
      currency: null,
      employmentType: null,
      experience: null,
      description,
      skills: [],
      applyUrl,
      companyUrl: null,
      sourceWebsite: SOURCE,
      postedDate,
      scrapedAt,
    });
  }
  return out;
}

/**
 * @param {string} slug
 * @param {string} companyName
 * @param {Date} scrapedAt
 */
async function fetchLever(slug, companyName, scrapedAt) {
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`;
  const { data } = await http.get(url);
  const list = Array.isArray(data) ? data : [];
  const out = [];

  for (const item of list) {
    const title = String(item.text || item.title || "").trim();
    const applyUrl = String(item.applyUrl || item.hostedUrl || "").trim();
    if (!title || !applyUrl) continue;

    let postedDate = null;
    if (item.createdAt) {
      const ms =
        typeof item.createdAt === "number" && item.createdAt < 1e12
          ? item.createdAt * 1000
          : Number(item.createdAt);
      const parsed = new Date(ms);
      if (!Number.isNaN(parsed.getTime())) postedDate = parsed;
    }

    const location =
      String(item.categories?.location || item.workplaceType || "Remote").trim() ||
      "Remote";
    const description =
      stripHtml(String(item.descriptionPlain || item.description || "")) ||
      `${title} at ${companyName} — Lever board.`;

    const salary =
      item.salaryRange?.min && item.salaryRange?.max
        ? `${item.salaryRange.min}-${item.salaryRange.max}`
        : null;

    out.push({
      title,
      company: companyName,
      location,
      salary,
      currency: item.salaryRange?.currency || null,
      employmentType: item.categories?.commitment
        ? String(item.categories.commitment)
        : null,
      experience: item.categories?.level
        ? String(item.categories.level)
        : null,
      description,
      skills: [],
      applyUrl,
      companyUrl: null,
      sourceWebsite: SOURCE,
      postedDate,
      scrapedAt,
    });
  }
  return out;
}

/**
 * @param {string} slug
 * @param {string} companyName
 * @param {Date} scrapedAt
 */
async function fetchAshby(slug, companyName, scrapedAt) {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`;
  const { data } = await http.get(url);
  const list = Array.isArray(data?.jobs) ? data.jobs : [];
  const out = [];

  for (const item of list) {
    const title = String(item.title || "").trim();
    const applyUrl = String(
      item.applyUrl || item.jobUrl || item.absoluteUrl || ""
    ).trim();
    if (!title || !applyUrl) continue;

    let postedDate = null;
    if (item.publishedAt || item.updatedAt) {
      const parsed = new Date(item.publishedAt || item.updatedAt);
      if (!Number.isNaN(parsed.getTime())) postedDate = parsed;
    }

    const location =
      String(item.location || item.workplaceType || "Remote").trim() || "Remote";
    const description =
      stripHtml(String(item.descriptionHtml || item.descriptionPlain || "")) ||
      `${title} at ${companyName} — Ashby board.`;

    const salary =
      item.compensation?.scrapeableCompensationSalarySummary ||
      item.compensation?.compensationTierSummary ||
      null;

    out.push({
      title,
      company: companyName,
      location,
      salary: salary ? String(salary) : null,
      currency: null,
      employmentType: item.employmentType ? String(item.employmentType) : null,
      experience: null,
      description,
      skills: [],
      applyUrl,
      companyUrl: null,
      sourceWebsite: SOURCE,
      postedDate,
      scrapedAt,
    });
  }
  return out;
}

function dedupeByUrl(jobs) {
  const unique = [];
  const seen = new Set();
  for (const job of jobs) {
    if (seen.has(job.applyUrl)) continue;
    seen.add(job.applyUrl);
    unique.push(job);
  }
  return unique;
}
