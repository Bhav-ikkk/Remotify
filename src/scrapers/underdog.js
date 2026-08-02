import { http, absoluteUrl, stripHtml } from "./http.js";
import { ScraperOutputSchema } from "./schema.js";

const SOURCE = "underdog";
const API_URL =
  "https://jobs-api.underdog.io/api/jobs/search?page=1&perPage=30&category_id=1";

/**
 * Scrape startup engineering roles from Underdog.io jobs API.
 * @returns {Promise<import('zod').infer<typeof ScraperOutputSchema>>}
 */
export async function scrape() {
  try {
    const scrapedAt = new Date();
    const { data } = await http.get(API_URL, {
      headers: {
        Accept: "application/json",
        Origin: "https://landing.underdog.io",
        Referer: "https://landing.underdog.io/startup-job-board",
      },
    });

    const rows = Array.isArray(data?.objJobs) ? data.objJobs : [];
    const jobs = rows
      .map((row) => {
        const title = row.title;
        if (!title) return null;

        const slug = row.webflow_slug || row.slug;
        const applyUrl = absoluteUrl(
          slug ? `/jobs/${encodeURIComponent(slug)}` : null,
          "https://landing.underdog.io"
        );
        if (!applyUrl) return null;

        const cities = Array.isArray(row.objCities)
          ? row.objCities
              .map((c) =>
                [c.name, c.state_abbreviation].filter(Boolean).join(", ")
              )
              .filter(Boolean)
          : [];
        const location = cities.length > 0 ? cities.join(" | ") : "Remote";

        let salary = null;
        let currency = null;
        if (row.min_salary || row.max_salary) {
          const min = row.min_salary ? `$${Number(row.min_salary).toLocaleString("en-US")}` : "";
          const max = row.max_salary ? `$${Number(row.max_salary).toLocaleString("en-US")}` : "";
          salary = [min, max].filter(Boolean).join(" - ");
          currency = "USD";
        }

        const description =
          stripHtml(row.description || row.meta_description || "") ||
          `${title} — engineering role via Underdog.io.`;

        return {
          title: String(title),
          // Underdog often conceals employer brands on the board.
          company: "Underdog Partner Company",
          location,
          salary,
          currency,
          employmentType: null,
          experience: null,
          description,
          skills: Array.isArray(row.objCategories)
            ? row.objCategories.map((c) => String(c.name || c.label)).filter(Boolean)
            : [],
          applyUrl,
          companyUrl: "https://www.underdog.io",
          sourceWebsite: SOURCE,
          postedDate: row.created_at ? new Date(row.created_at) : null,
          scrapedAt,
        };
      })
      .filter(Boolean);

    return ScraperOutputSchema.parse(jobs);
  } catch (error) {
    console.error(
      `[${SOURCE}] scrape failed:`,
      error instanceof Error ? error.message : error
    );
    return [];
  }
}
