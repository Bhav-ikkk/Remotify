import { ScraperOutputSchema } from "./schema.js";
import { getSetting, SETTING_KEYS } from "@/services/settings";
import { fetchLatestZyteItems } from "@/utils/zyte-cloud";

const SOURCE = "wellfound";
const SPIDER_NAME = "wellfound";

/**
 * Pull Wellfound listings from the latest finished Zyte Scrapy Cloud run.
 * Credentials resolve DB settings first, then environment variables.
 *
 * @returns {Promise<import('zod').infer<typeof ScraperOutputSchema>>}
 */
export async function scrape() {
  try {
    const { projectId, apiKey } = await resolveZyteCredentials();

    if (!projectId || !apiKey) {
      console.error(
        `[${SOURCE}] missing Zyte credentials (ZYTE_API_KEY / ZYTE_PROJECT_ID)`
      );
      return [];
    }

    const rawItems = await fetchLatestZyteItems(
      projectId,
      apiKey,
      SPIDER_NAME
    );
    const jobs = rawItems.map(normalizeZyteItem).filter(Boolean);

    return ScraperOutputSchema.parse(jobs);
  } catch (error) {
    console.error(
      `[${SOURCE}] Zyte fetch failed:`,
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

/**
 * @returns {Promise<{ projectId: string, apiKey: string }>}
 */
async function resolveZyteCredentials() {
  const [dbApiKey, dbProjectId] = await Promise.all([
    getSetting(SETTING_KEYS.ZYTE_API_KEY),
    getSetting(SETTING_KEYS.ZYTE_PROJECT_ID),
  ]);

  const apiKey =
    (typeof dbApiKey === "string" && dbApiKey.trim()) ||
    process.env.ZYTE_API_KEY?.trim() ||
    "";
  const projectId =
    (typeof dbProjectId === "string" && dbProjectId.trim()) ||
    (typeof dbProjectId === "number" ? String(dbProjectId) : "") ||
    process.env.ZYTE_PROJECT_ID?.trim() ||
    "";

  return { projectId, apiKey };
}

/**
 * Coerce Zyte Storage JSON into JobSchema-shaped objects.
 * @param {Record<string, unknown>} item
 */
function normalizeZyteItem(item) {
  if (!item || typeof item !== "object") return null;

  const applyUrl = asString(item.applyUrl);
  const title = asString(item.title);
  const company = asString(item.company);
  if (!applyUrl || !title || !company) return null;

  const companyUrlRaw = asString(item.companyUrl);
  let companyUrl = null;
  if (companyUrlRaw) {
    try {
      companyUrl = new URL(companyUrlRaw).toString();
    } catch {
      companyUrl = null;
    }
  }

  const skills = Array.isArray(item.skills)
    ? item.skills.map((s) => String(s).trim()).filter(Boolean)
    : [];

  return {
    title,
    company,
    location: asString(item.location) || "Remote",
    salary: asNullableString(item.salary),
    currency: asNullableString(item.currency),
    employmentType: asNullableString(item.employmentType),
    experience: asNullableString(item.experience),
    description:
      asString(item.description) || `${title} at ${company} — Wellfound listing.`,
    skills,
    applyUrl,
    companyUrl,
    sourceWebsite: asString(item.sourceWebsite) || SOURCE,
    postedDate: coerceDate(item.postedDate),
    scrapedAt: coerceDate(item.scrapedAt) || new Date(),
  };
}

/** @param {unknown} value */
function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** @param {unknown} value */
function asNullableString(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

/** @param {unknown} value */
function coerceDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
