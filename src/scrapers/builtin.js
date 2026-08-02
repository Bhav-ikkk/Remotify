import * as cheerio from "cheerio";
import { http, absoluteUrl, stripHtml } from "./http.js";
import { ScraperOutputSchema } from "./schema.js";

const SOURCE = "builtin";
const LIST_URL = "https://builtin.com/jobs/remote/dev-engineering";

/**
 * Scrape remote engineering roles from Built In (HTML listing cards).
 * Falls back gracefully if the JSON API is unavailable.
 * @returns {Promise<import('zod').infer<typeof ScraperOutputSchema>>}
 */
export async function scrape() {
  try {
    const scrapedAt = new Date();

    // Prefer JSON API when it returns jobs; otherwise parse SSR HTML cards.
    const fromApi = await tryLegacyJsonApi(scrapedAt);
    if (fromApi.length > 0) {
      return ScraperOutputSchema.parse(fromApi);
    }

    const { data: html } = await http.get(LIST_URL);
    const $ = cheerio.load(html);
    const jobs = [];
    const seen = new Set();

    $("a[href*='/job/']").each((_, el) => {
      const anchor = $(el);
      const title = anchor.text().replace(/\s+/g, " ").trim();
      const applyUrl = absoluteUrl(anchor.attr("href"), "https://builtin.com");
      if (!title || !applyUrl || seen.has(applyUrl)) return;
      // Skip tiny non-title anchors
      if (title.length < 3) return;

      const card = anchor.closest("[class*='job-card'], [class*='job-bounded'], li, article, div");
      const companyAnchor = card
        .find("a[href*='/company/']")
        .filter((__, a) => $(a).text().trim().length > 0)
        .first();

      const company =
        companyAnchor.text().replace(/\s+/g, " ").trim() || "Unknown Company";
      const companyUrl = absoluteUrl(
        companyAnchor.attr("href"),
        "https://builtin.com"
      );

      const blob = card.text().replace(/\s+/g, " ").trim();
      const description =
        blob.length > 40
          ? blob.slice(0, 1200)
          : `${title} at ${company} — remote engineering role on Built In.`;

      jobs.push({
        title,
        company,
        location: "Remote",
        salary: null,
        currency: null,
        employmentType: null,
        experience: null,
        description: stripHtml(description),
        skills: [],
        applyUrl,
        companyUrl,
        sourceWebsite: SOURCE,
        postedDate: null,
        scrapedAt,
      });
      seen.add(applyUrl);
    });

    return ScraperOutputSchema.parse(jobs);
  } catch (error) {
    console.error(
      `[${SOURCE}] scrape failed:`,
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

/**
 * Attempt Built In legacy JSON retrieval.
 * @param {Date} scrapedAt
 */
async function tryLegacyJsonApi(scrapedAt) {
  try {
    const url =
      "https://api.builtin.com/services/job-retrieval/legacy-jobs" +
      "?categories=149&companyRegion=USA&jobsPerPage=40&page=1";
    const { data } = await http.get(url, {
      headers: {
        Accept: "application/json",
        Origin: "https://builtin.com",
        Referer: LIST_URL,
      },
    });

    const rows = Array.isArray(data?.jobs) ? data.jobs : [];
    return rows
      .map((row) => {
        const title = row.title || row.job_title;
        const company =
          row.company_name || row.company?.name || "Unknown Company";
        const path = row.alias || row.url || row.job_url;
        const applyUrl = absoluteUrl(path, "https://builtin.com");
        if (!title || !applyUrl) return null;

        return {
          title: String(title),
          company: String(company),
          location: row.remote ? "Remote" : row.location || "Remote",
          salary: row.salary || null,
          currency: row.salary ? "USD" : null,
          employmentType: row.employment_type || null,
          experience: row.experience_level || null,
          description:
            stripHtml(row.body || row.description || "") ||
            `${title} at ${company}`,
          skills: Array.isArray(row.skills)
            ? row.skills.map(String)
            : [],
          applyUrl,
          companyUrl: absoluteUrl(
            row.company_url || row.company?.url,
            "https://builtin.com"
          ),
          sourceWebsite: SOURCE,
          postedDate: row.published_at ? new Date(row.published_at) : null,
          scrapedAt,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}
