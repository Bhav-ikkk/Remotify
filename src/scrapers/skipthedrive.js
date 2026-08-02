import * as cheerio from "cheerio";
import { http, absoluteUrl, stripHtml } from "./http.js";
import { ScraperOutputSchema } from "./schema.js";

const SOURCE = "skipthedrive";
const SEARCH_URL =
  "https://www.skipthedrive.com/?s=software+developer";

/**
 * Scrape remote software/development roles from SkipTheDrive.
 * @returns {Promise<import('zod').infer<typeof ScraperOutputSchema>>}
 */
export async function scrape() {
  try {
    const scrapedAt = new Date();
    const { data: html } = await http.get(SEARCH_URL);
    const $ = cheerio.load(html);
    const jobs = [];

    $("article.job, article.type-job, article").each((_, el) => {
      const article = $(el);
      const titleAnchor = article.find("h2 a, h3 a, .post-title a").first();
      const title = titleAnchor.text().trim();
      const applyUrl = absoluteUrl(
        titleAnchor.attr("href"),
        "https://www.skipthedrive.com"
      );

      if (!title || !applyUrl) return;

      const company =
        article
          .find(".custom_fields_company_name_display_search_results")
          .text()
          .replace(/\s+/g, " ")
          .trim() || "Unknown Company";

      const excerpt = stripHtml(
        article.find(".excerpt_part, .entry-content").first().html() || ""
      );
      const description =
        excerpt ||
        `${title} at ${company} — remote role listed on SkipTheDrive.`;

      const datetime = article.find("time[datetime]").attr("datetime");
      let postedDate = null;
      if (datetime) {
        const parsed = new Date(datetime);
        if (!Number.isNaN(parsed.getTime())) postedDate = parsed;
      }

      jobs.push({
        title,
        company,
        location: "Remote",
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

    // Deduplicate by applyUrl within this batch
    const unique = [];
    const seen = new Set();
    for (const job of jobs) {
      if (seen.has(job.applyUrl)) continue;
      seen.add(job.applyUrl);
      unique.push(job);
    }

    return ScraperOutputSchema.parse(unique);
  } catch (error) {
    console.error(
      `[${SOURCE}] scrape failed:`,
      error instanceof Error ? error.message : error
    );
    return [];
  }
}
