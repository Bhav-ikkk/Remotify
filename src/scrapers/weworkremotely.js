import * as cheerio from "cheerio";
import { http, stripHtml } from "./http.js";
import { ScraperOutputSchema } from "./schema.js";
import { titlePassesQualityFilter } from "../utils/job-quality.js";

const SOURCE = "weworkremotely";
const FEEDS = [
  "https://weworkremotely.com/categories/remote-programming-jobs.rss",
  "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss",
];

/**
 * We Work Remotely public RSS feeds (programming + full-stack categories).
 * @returns {Promise<import('zod').infer<typeof ScraperOutputSchema>>}
 */
export async function scrape() {
  const scrapedAt = new Date();
  const jobs = [];

  for (const feedUrl of FEEDS) {
    try {
      const { data } = await http.get(feedUrl, { responseType: "text" });
      const $ = cheerio.load(String(data), { xmlMode: true });

      $("item").each((_, el) => {
        const item = $(el);
        const rawTitle = item.find("title").first().text().trim();
        const applyUrl = item.find("link").first().text().trim();
        if (!rawTitle || !applyUrl) return;

        // RSS titles look like "Company: Job Title"
        const splitAt = rawTitle.indexOf(":");
        const company =
          splitAt > 0 ? rawTitle.slice(0, splitAt).trim() : "Unknown Company";
        const title = splitAt > 0 ? rawTitle.slice(splitAt + 1).trim() : rawTitle;
        if (!titlePassesQualityFilter(title)) return;

        const region = item.find("region").first().text().trim();
        const pubDate = item.find("pubDate").first().text().trim();
        let postedDate = null;
        if (pubDate) {
          const parsed = new Date(pubDate);
          if (!Number.isNaN(parsed.getTime())) postedDate = parsed;
        }

        const description =
          stripHtml(item.find("description").first().text()) ||
          `${title} at ${company} — We Work Remotely listing.`;

        jobs.push({
          title,
          company,
          location: region || "Remote",
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
      });
    } catch (error) {
      console.error(
        "[scraper:weworkremotely]",
        error instanceof Error ? error.message : error
      );
    }
  }

  try {
    return ScraperOutputSchema.parse(dedupeByUrl(jobs));
  } catch (error) {
    console.error(
      "[scraper:weworkremotely] schema:",
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
