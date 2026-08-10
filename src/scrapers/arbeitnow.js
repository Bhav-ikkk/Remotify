import { http, stripHtml } from "./http.js";
import { ScraperOutputSchema } from "./schema.js";
import { titlePassesQualityFilter } from "../utils/job-quality.js";

const SOURCE = "arbeitnow";
const API_URL = "https://www.arbeitnow.com/api/job-board-api";

/**
 * Free Arbeitnow feed — often surfaces employer ATS apply URLs.
 * @returns {Promise<import('zod').infer<typeof ScraperOutputSchema>>}
 */
export async function scrape() {
  try {
    const scrapedAt = new Date();
    const { data } = await http.get(API_URL);
    const list = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.jobs)
        ? data.jobs
        : Array.isArray(data)
          ? data
          : [];
    const jobs = [];

    for (const item of list) {
      const title = String(item.title || "").trim();
      const applyUrl = String(item.url || item.apply_url || "").trim();
      if (!title || !applyUrl || !/^https?:\/\//i.test(applyUrl)) continue;
      if (!titlePassesQualityFilter(title)) continue;

      // Prefer remote / tech-tagged roles
      const tags = Array.isArray(item.tags)
        ? item.tags.map((t) => String(t).toLowerCase())
        : [];
      const isRemote =
        item.remote === true ||
        /remote/i.test(String(item.location || "")) ||
        tags.includes("remote");
      if (!isRemote) continue;

      const techish =
        tags.length === 0 ||
        tags.some((t) =>
          /software|engineer|developer|devops|backend|frontend|full.?stack|javascript|typescript|python|java|react|node/.test(
            t
          )
        ) ||
        /engineer|developer|software|fullstack|full.?stack|backend|frontend/i.test(
          title
        );
      if (!techish) continue;

      let postedDate = null;
      if (item.created_at) {
        const parsed = new Date(
          typeof item.created_at === "number"
            ? item.created_at * 1000
            : item.created_at
        );
        if (!Number.isNaN(parsed.getTime())) postedDate = parsed;
      }

      const description =
        stripHtml(String(item.description || "")) ||
        `${title} at ${item.company_name || "company"} — Arbeitnow listing.`;

      jobs.push({
        title,
        company: String(item.company_name || "Unknown Company").trim(),
        location: String(item.location || "Remote").trim() || "Remote",
        salary: item.salary ? String(item.salary) : null,
        currency: null,
        employmentType: item.job_types
          ? Array.isArray(item.job_types)
            ? item.job_types.join(", ")
            : String(item.job_types)
          : null,
        experience: null,
        description,
        skills: tags.slice(0, 20),
        applyUrl,
        companyUrl: null,
        sourceWebsite: SOURCE,
        postedDate,
        scrapedAt,
      });
    }

    return ScraperOutputSchema.parse(dedupeByUrl(jobs));
  } catch (error) {
    console.error("[scraper:arbeitnow]", error instanceof Error ? error.message : error);
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
