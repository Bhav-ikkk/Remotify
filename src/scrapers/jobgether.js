import * as cheerio from "cheerio";
import { http, absoluteUrl } from "./http.js";
import { ScraperOutputSchema } from "./schema.js";

const SOURCE = "jobgether";
const SEARCH_URL =
  "https://jobgether.com/search-offers?keyword=software%20engineer";

/**
 * Scrape remote developer roles from Jobgether search HTML / embedded props.
 * @returns {Promise<import('zod').infer<typeof ScraperOutputSchema>>}
 */
export async function scrape() {
  try {
    const scrapedAt = new Date();
    const { data: html } = await http.get(SEARCH_URL);
    const decoded = decodeEntities(String(html));

    const fromProps = extractFromSerializedProps(decoded, scrapedAt);
    if (fromProps.length > 0) {
      return ScraperOutputSchema.parse(fromProps);
    }

    // DOM fallback — offer anchors when props parsing yields nothing.
    const $ = cheerio.load(html);
    const jobs = [];
    const seen = new Set();

    $("a[href*='/offer/']").each((_, el) => {
      const anchor = $(el);
      const href = absoluteUrl(anchor.attr("href"), "https://jobgether.com");
      const title = anchor.text().replace(/\s+/g, " ").trim();
      if (!href || !title || seen.has(href)) return;

      jobs.push({
        title,
        company: guessCompanyFromSlug(href) || "Unknown Company",
        location: "Remote",
        salary: null,
        currency: null,
        employmentType: null,
        experience: null,
        description: `${title} — remote role listed on Jobgether.`,
        skills: [],
        applyUrl: href,
        companyUrl: null,
        sourceWebsite: SOURCE,
        postedDate: null,
        scrapedAt,
      });
      seen.add(href);
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
 * @param {string} html
 */
function decodeEntities(html) {
  return html
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'");
}

/**
 * Jobgether embeds Solid-style serialized props in the page payload.
 * @param {string} html
 * @param {Date} scrapedAt
 */
function extractFromSerializedProps(html, scrapedAt) {
  const applyMatches = [
    ...html.matchAll(/"applyUrl":\[0,"(https?:\/\/[^"]+)"\]/g),
  ];
  if (applyMatches.length === 0) return [];

  const titleMatches = [
    ...html.matchAll(/"title":\[0,"([^"]{3,200})"\]/g),
  ].map((m) => m[1]);

  const contractMatches = [
    ...html.matchAll(/"contractType":\[0,"([^"]*)"\]/g),
  ].map((m) => m[1]);

  const experienceMatches = [
    ...html.matchAll(/"experience":\[0,"([^"]*)"\]/g),
  ].map((m) => m[1]);

  const remoteMatches = [
    ...html.matchAll(/"remoteOfferType":\[0,"([^"]*)"\]/g),
  ].map((m) => m[1]);

  const countryMatches = [
    ...html.matchAll(/"countries":\[1,\[\[0,\{"name":\[0,"([^"]+)"\]/g),
  ].map((m) => m[1]);

  const salaryBlocks = [
    ...html.matchAll(
      /"salary":\[0,\{"average":\[0,(\d+|null)\],"currency":\[0,"([^"]+)"\],"max":\[0,(\d+|null)\],"min":\[0,(\d+|null)\]/g
    ),
  ];

  const idMatches = [...html.matchAll(/"_id":\[0,"([a-f0-9]{20,})"\]/g)].map(
    (m) => m[1]
  );

  const jobs = [];
  const seen = new Set();

  for (let i = 0; i < applyMatches.length; i++) {
    const applyUrl = applyMatches[i][1];
    if (seen.has(applyUrl)) continue;
    seen.add(applyUrl);

    const title = titleMatches[i] || titleMatches[0];
    if (!title) continue;

    const salaryMatch = salaryBlocks[i];
    let salary = null;
    let currency = null;
    if (salaryMatch) {
      const min = salaryMatch[4] !== "null" ? Number(salaryMatch[4]) : null;
      const max = salaryMatch[3] !== "null" ? Number(salaryMatch[3]) : null;
      currency = salaryMatch[2] || null;
      if (min || max) {
        salary = [min, max]
          .filter((n) => typeof n === "number" && Number.isFinite(n))
          .map((n) => `${currency || "USD"} ${n.toLocaleString("en-US")}`)
          .join(" - ");
      }
    }

    const locationParts = [
      remoteMatches[i] || "Remote",
      countryMatches[i],
    ].filter(Boolean);

    const company =
      guessCompanyFromApplyUrl(applyUrl) ||
      guessCompanyFromSlug(idMatches[i] ? `/offer/${idMatches[i]}` : "") ||
      "Unknown Company";

    jobs.push({
      title: unescapeJsonString(title),
      company,
      location: locationParts.join(" · "),
      salary,
      currency,
      employmentType: contractMatches[i] || null,
      experience: experienceMatches[i] || null,
      description: `${unescapeJsonString(title)} at ${company} — sourced from Jobgether.`,
      skills: [],
      applyUrl,
      companyUrl: null,
      sourceWebsite: SOURCE,
      postedDate: null,
      scrapedAt,
    });
  }

  return jobs;
}

/**
 * @param {string} value
 */
function unescapeJsonString(value) {
  return value.replace(/\\u([\dA-Fa-f]{4})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

/**
 * @param {string} applyUrl
 */
function guessCompanyFromApplyUrl(applyUrl) {
  try {
    const u = new URL(applyUrl);
    // ashbyhq.com/{company}/...
    if (u.hostname.includes("ashbyhq.com")) {
      const part = u.pathname.split("/").filter(Boolean)[0];
      return part ? titleCase(part.replace(/[-_]/g, " ")) : null;
    }
    // boards.greenhouse.io/{company}/...
    if (u.hostname.includes("greenhouse.io")) {
      const part = u.pathname.split("/").filter(Boolean)[0];
      return part ? titleCase(part.replace(/[-_]/g, " ")) : null;
    }
    // lever.co/{company}/...
    if (u.hostname.includes("lever.co")) {
      const part = u.pathname.split("/").filter(Boolean)[0];
      return part ? titleCase(part.replace(/[-_]/g, " ")) : null;
    }
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * @param {string} href
 */
function guessCompanyFromSlug(href) {
  if (!href) return null;
  const slug = href.split("/").filter(Boolean).pop() || "";
  const parts = slug.split("-").filter(Boolean);
  if (parts.length < 2) return null;
  // drop id-looking prefixes
  const cleaned = parts.filter((p) => !/^[a-f0-9]{8,}$/i.test(p));
  return cleaned.length ? titleCase(cleaned.slice(0, 3).join(" ")) : null;
}

/**
 * @param {string} text
 */
function titleCase(text) {
  return text
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
