import { http, stripHtml } from "./http.js";
import { ScraperOutputSchema } from "./schema.js";
import { titlePassesQualityFilter } from "../utils/job-quality.js";

const SOURCE = "workingnomads";
const API_URL = "https://www.workingnomads.com/api/exposed_jobs/";

/**
 * Free Working Nomads exposed jobs API (development category).
 * @returns {Promise<import('zod').infer<typeof ScraperOutputSchema>>}
 */
export async function scrape() {
  try {
    const scrapedAt = new Date();
    const { data } = await http.get(API_URL);
    const list = Array.isArray(data) ? data : [];
    const jobs = [];

    for (const item of list) {
      const category = String(item.category_name || "").toLowerCase();
      if (category && !/develop|engineering|it\b/.test(category)) continue;

      const applyUrl = String(item.url || "").trim();
      const title = String(item.title || "").trim();
      if (!applyUrl || !title) continue;
      if (!titlePassesQualityFilter(title)) continue;

      let postedDate = null;
      if (item.pub_date) {
        const parsed = new Date(item.pub_date);
        if (!Number.isNaN(parsed.getTime())) postedDate = parsed;
      }

      const skills = String(item.tags || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 20);

      const description =
        stripHtml(String(item.description || "")) ||
        `${title} at ${item.company_name || "company"} — Working Nomads listing.`;

      jobs.push({
        title,
        company: String(item.company_name || "Unknown Company").trim(),
        location: String(item.location || "Remote").trim() || "Remote",
        salary: null,
        currency: null,
        employmentType: null,
        experience: null,
        description,
        skills,
        applyUrl,
        companyUrl: null,
        sourceWebsite: SOURCE,
        postedDate,
        scrapedAt,
      });
    }

    return ScraperOutputSchema.parse(dedupeByUrl(jobs));
  } catch (error) {
    console.error(
      "[scraper:workingnomads]",
      error instanceof Error ? error.message : error
    );
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
