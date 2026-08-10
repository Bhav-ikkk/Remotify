import { http, stripHtml } from "./http.js";
import { ScraperOutputSchema } from "./schema.js";
import { titlePassesQualityFilter } from "../utils/job-quality.js";

const SOURCE = "himalayas";
const SEARCH_URL =
  "https://himalayas.app/jobs/api/search?q=software%20engineer&worldwide=true&sort=recent&page=1";

/**
 * Free Himalayas remote jobs search API (no auth).
 * @returns {Promise<import('zod').infer<typeof ScraperOutputSchema>>}
 */
export async function scrape() {
  try {
    const scrapedAt = new Date();
    const { data } = await http.get(SEARCH_URL);
    const list = Array.isArray(data?.jobs)
      ? data.jobs
      : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
          ? data
          : [];
    const jobs = [];

    for (const item of list) {
      const title = String(item.title || item.jobTitle || "").trim();
      const applyUrl = String(
        item.applicationLink ||
          item.applyUrl ||
          item.url ||
          item.excerpt ||
          item.guid ||
          ""
      ).trim();
      if (!title || !applyUrl || !/^https?:\/\//i.test(applyUrl)) continue;
      if (!titlePassesQualityFilter(title)) continue;

      let postedDate = null;
      const dateRaw =
        item.pubDate || item.publishedAt || item.createdAt || item.updatedAt;
      if (dateRaw) {
        const parsed = new Date(dateRaw);
        if (!Number.isNaN(parsed.getTime())) postedDate = parsed;
      }

      const company = String(
        item.companyName || item.company?.name || item.company || "Unknown Company"
      ).trim();

      const location = Array.isArray(item.locationRestrictions)
        ? item.locationRestrictions.join(", ") || "Remote"
        : String(item.location || "Remote").trim() || "Remote";

      const description =
        stripHtml(String(item.description || item.excerpt || "")) ||
        `${title} at ${company} — Himalayas listing.`;

      const skills = Array.isArray(item.categories)
        ? item.categories.map((c) => String(c)).slice(0, 20)
        : Array.isArray(item.skills)
          ? item.skills.map((s) => String(s)).slice(0, 20)
          : [];

      jobs.push({
        title,
        company,
        location,
        salary:
          item.minSalary || item.maxSalary
            ? `${item.minSalary || "?"}-${item.maxSalary || "?"}`
            : item.salary ? String(item.salary) : null,
        currency: item.currency ? String(item.currency) : null,
        employmentType: item.employmentType ? String(item.employmentType) : null,
        experience: item.seniority ? String(item.seniority) : null,
        description,
        skills,
        applyUrl,
        companyUrl: item.companyLogo ? null : null,
        sourceWebsite: SOURCE,
        postedDate,
        scrapedAt,
      });
    }

    return ScraperOutputSchema.parse(dedupeByUrl(jobs));
  } catch (error) {
    console.error("[scraper:himalayas]", error instanceof Error ? error.message : error);
    return [];
  }
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
