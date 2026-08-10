import { http, stripHtml } from "./http.js";
import { ScraperOutputSchema } from "./schema.js";
import { titlePassesQualityFilter } from "../utils/job-quality.js";

const SOURCE = "remoteok";
const API_URL = "https://remoteok.com/api";

/**
 * Free RemoteOK JSON board. Skip element 0 (legal notice); attribute if republishing.
 * @returns {Promise<import('zod').infer<typeof ScraperOutputSchema>>}
 */
export async function scrape() {
  try {
    const scrapedAt = new Date();
    const { data } = await http.get(API_URL, {
      headers: {
        Accept: "application/json",
      },
    });
    const list = Array.isArray(data) ? data : [];
    const jobs = [];

    for (const item of list) {
      // First row is legal notice without id/position
      if (!item || typeof item !== "object" || !item.id || !item.position) continue;

      const title = String(item.position || "").trim();
      const applyUrl = String(
        item.apply_url || item.url || `https://remoteok.com/remote-jobs/${item.id}`
      ).trim();
      if (!title || !applyUrl) continue;
      if (!titlePassesQualityFilter(title)) continue;

      // Prefer engineering-ish tags when present
      const tags = Array.isArray(item.tags)
        ? item.tags.map((t) => String(t).toLowerCase())
        : [];
      const engHint =
        tags.length === 0 ||
        tags.some((t) =>
          /dev|engineer|software|fullstack|full-stack|backend|frontend|typescript|javascript|python|react|node/.test(
            t
          )
        );
      if (!engHint) continue;

      let postedDate = null;
      if (item.date) {
        const parsed = new Date(item.date);
        if (!Number.isNaN(parsed.getTime())) postedDate = parsed;
      } else if (item.epoch) {
        const parsed = new Date(Number(item.epoch) * 1000);
        if (!Number.isNaN(parsed.getTime())) postedDate = parsed;
      }

      const salary =
        item.salary_min || item.salary_max
          ? `${item.salary_min || "?"}-${item.salary_max || "?"}`
          : null;

      const description =
        stripHtml(String(item.description || "")) ||
        `${title} at ${item.company || "company"} — RemoteOK listing.`;

      jobs.push({
        title,
        company: String(item.company || "Unknown Company").trim(),
        location: String(item.location || "Remote").trim() || "Remote",
        salary,
        currency: "USD",
        employmentType: null,
        experience: null,
        description,
        skills: Array.isArray(item.tags)
          ? item.tags.map((t) => String(t)).slice(0, 20)
          : [],
        applyUrl,
        companyUrl: item.company_logo ? null : null,
        sourceWebsite: SOURCE,
        postedDate,
        scrapedAt,
      });
    }

    return ScraperOutputSchema.parse(dedupeByUrl(jobs));
  } catch (error) {
    console.error("[scraper:remoteok]", error instanceof Error ? error.message : error);
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
