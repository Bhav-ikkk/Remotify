import { http, stripHtml } from "./http.js";
import { ScraperOutputSchema } from "./schema.js";
import { titlePassesQualityFilter } from "../utils/job-quality.js";

const SOURCE = "remotive";
const API_URL =
  "https://remotive.com/api/remote-jobs?category=software-dev&limit=100";

/**
 * Free Remotive software-dev remote jobs API (attribution required if republishing).
 * @returns {Promise<import('zod').infer<typeof ScraperOutputSchema>>}
 */
export async function scrape() {
  try {
    const scrapedAt = new Date();
    const { data } = await http.get(API_URL);
    const list = Array.isArray(data?.jobs) ? data.jobs : [];
    const jobs = [];

    for (const item of list) {
      const applyUrl = String(item.url || "").trim();
      const title = String(item.title || "").trim();
      if (!applyUrl || !title) continue;
      if (!titlePassesQualityFilter(title)) continue;

      let postedDate = null;
      if (item.publication_date) {
        const parsed = new Date(item.publication_date);
        if (!Number.isNaN(parsed.getTime())) postedDate = parsed;
      }

      const descriptionHtml = String(item.description || "");
      const description =
        stripHtml(descriptionHtml) ||
        `${title} at ${item.company_name || "company"} — Remotive listing.`;

      jobs.push({
        title,
        company: String(item.company_name || "Unknown Company").trim(),
        location: String(item.candidate_required_location || "Remote").trim() || "Remote",
        salary: item.salary ? String(item.salary) : null,
        currency: null,
        employmentType: item.job_type ? String(item.job_type) : null,
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

    return ScraperOutputSchema.parse(dedupeByUrl(jobs));
  } catch (error) {
    console.error("[scraper:remotive]", error instanceof Error ? error.message : error);
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
