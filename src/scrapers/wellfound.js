import { http, absoluteUrl, stripHtml } from "./http.js";
import { ScraperOutputSchema } from "./schema.js";

const SOURCE = "wellfound";

/**
 * Scrape software engineering roles from Wellfound.
 *
 * Wellfound fronts Datadome / JS challenges that block plain Axios in most
 * environments. This V1 fetcher attempts a lightweight HTML/JSON probe and
 * returns [] on bot mitigation so the pipeline stays resilient.
 *
 * @returns {Promise<import('zod').infer<typeof ScraperOutputSchema>>}
 */
export async function scrape() {
  try {
    const scrapedAt = new Date();
    const targets = [
      "https://wellfound.com/role/l/software-engineer/remote",
      "https://wellfound.com/jobs?remote=true&role=engineering",
      "https://www.wellfound.com/role/software-engineer",
    ];

    for (const url of targets) {
      try {
        const { data, status, headers } = await http.get(url, {
          validateStatus: () => true,
          headers: {
            Accept: "text/html,application/xhtml+xml",
            Referer: "https://wellfound.com/",
          },
        });

        if (status === 403 || status === 429) {
          console.error(
            `[${SOURCE}] blocked by anti-bot (HTTP ${status}) for ${url}`
          );
          continue;
        }

        if (status >= 400) {
          console.error(`[${SOURCE}] HTTP ${status} for ${url}`);
          continue;
        }

        const html = String(data);
        if (
          /Please enable JS and disable any ad blocker/i.test(html) ||
          /captcha|datadome|cf-challenge/i.test(html)
        ) {
          console.error(
            `[${SOURCE}] JS/captcha challenge detected for ${url}`
          );
          continue;
        }

        const jobs = extractJobsFromHtml(html, scrapedAt);
        if (jobs.length > 0) {
          return ScraperOutputSchema.parse(jobs);
        }
      } catch (inner) {
        console.error(
          `[${SOURCE}] probe failed for ${url}:`,
          inner instanceof Error ? inner.message : inner
        );
      }
    }

    // Optional V1 mock when explicitly enabled for local schema demos.
    if (process.env.REMOTIFY_WELLFOUND_MOCK === "1") {
      return ScraperOutputSchema.parse([
        {
          title: "Software Engineer (Mock)",
          company: "Wellfound Mock Co",
          location: "Remote",
          salary: null,
          currency: null,
          employmentType: "full-time",
          experience: null,
          description:
            "Synthetic Wellfound fixture used when live scraping is blocked.",
          skills: ["JavaScript"],
          applyUrl: "https://wellfound.com/jobs/mock-software-engineer",
          companyUrl: "https://wellfound.com",
          sourceWebsite: SOURCE,
          postedDate: null,
          scrapedAt,
        },
      ]);
    }

    console.error(
      `[${SOURCE}] no usable listings — returning empty array (bot mitigation)`
    );
    return [];
  } catch (error) {
    console.error(
      `[${SOURCE}] scrape failed:`,
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

/**
 * Best-effort extraction if HTML is served without a challenge page.
 * @param {string} html
 * @param {Date} scrapedAt
 */
function extractJobsFromHtml(html, scrapedAt) {
  const jobs = [];
  const seen = new Set();

  const linkMatches = [
    ...html.matchAll(/href="(\/jobs\/[^"]+)"[^>]*>([^<]{3,120})</gi),
  ];

  for (const match of linkMatches) {
    const applyUrl = absoluteUrl(match[1], "https://wellfound.com");
    const title = stripHtml(match[2]);
    if (!applyUrl || !title || seen.has(applyUrl)) continue;
    if (!/engineer|developer|software/i.test(title)) continue;

    jobs.push({
      title,
      company: "Unknown Company",
      location: "Remote",
      salary: null,
      currency: null,
      employmentType: null,
      experience: null,
      description: `${title} — software role listed on Wellfound.`,
      skills: [],
      applyUrl,
      companyUrl: null,
      sourceWebsite: SOURCE,
      postedDate: null,
      scrapedAt,
    });
    seen.add(applyUrl);
  }

  return jobs;
}
