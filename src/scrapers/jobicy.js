import { http, stripHtml } from "./http.js";
import { ScraperOutputSchema } from "./schema.js";
import { titlePassesQualityFilter } from "../utils/job-quality.js";

const SOURCE = "jobicy";
const API_URL = "https://jobicy.com/api/v2/remote-jobs?count=50&industry=dev";

/**
 * Free Jobicy remote jobs API (dev industry).
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
      const title = String(item.jobTitle || "").trim();
      if (!applyUrl || !title) continue;
      if (!titlePassesQualityFilter(title)) continue;

      let postedDate = null;
      if (item.pubDate) {
        const parsed = new Date(item.pubDate);
        if (!Number.isNaN(parsed.getTime())) postedDate = parsed;
      }

      const salaryMin = Number(item.annualSalaryMin) || 0;
      const salaryMax = Number(item.annualSalaryMax) || 0;
      const salary =
        salaryMin && salaryMax
          ? `${salaryMin} – ${salaryMax}`
          : salaryMin || salaryMax
            ? String(salaryMin || salaryMax)
            : null;

      const jobType = Array.isArray(item.jobType)
        ? item.jobType.join(", ")
        : item.jobType
          ? String(item.jobType)
          : null;

      const description =
        stripHtml(String(item.jobDescription || item.jobExcerpt || "")) ||
        `${title} at ${item.companyName || "company"} — Jobicy listing.`;

      jobs.push({
        title,
        company: String(item.companyName || "Unknown Company").trim(),
        location: String(item.jobGeo || "Remote").trim() || "Remote",
        salary,
        currency: item.salaryCurrency ? String(item.salaryCurrency) : null,
        employmentType: jobType,
        experience: item.jobLevel ? String(item.jobLevel) : null,
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
    console.error("[scraper:jobicy]", error instanceof Error ? error.message : error);
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
