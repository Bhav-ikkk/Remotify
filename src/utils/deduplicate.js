import { prisma } from "../services/database.js";
import { calculateSimilarity } from "./similarity.js";

const SIMILARITY_THRESHOLD = 0.9;
const LOOKBACK_DAYS = 30;

/**
 * Normalize apply URLs for stable comparisons (strip tracking params / trailing slash).
 * @param {string} url
 */
function normalizeApplyUrl(url) {
  try {
    const parsed = new URL(String(url));
    parsed.hash = "";
    // Drop common tracking params
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref", "source"].forEach(
      (key) => parsed.searchParams.delete(key)
    );
    let href = parsed.toString();
    if (href.endsWith("/")) href = href.slice(0, -1);
    return href.toLowerCase();
  } catch {
    return String(url || "")
      .trim()
      .toLowerCase()
      .replace(/\/$/, "");
  }
}

/**
 * @param {string} company
 * @param {string} title
 */
function companyTitleKey(company, title) {
  return `${String(company || "")
    .trim()
    .toLowerCase()}::${String(title || "")
    .trim()
    .toLowerCase()}`;
}

/**
 * Remove duplicate jobs within the current batch and against Neon history.
 *
 * Match rules:
 * - applyUrl equality (normalized), OR
 * - (company AND title) equality, OR
 * - description Jaccard similarity > 90% vs recent same-company jobs
 *
 * @param {Array<object>} rawJobs
 * @returns {Promise<{ uniqueJobs: Array<object>, duplicateCount: number }>}
 */
export async function filterDuplicates(rawJobs) {
  const incoming = Array.isArray(rawJobs) ? rawJobs : [];
  let duplicateCount = 0;

  // --- Step A: intra-batch deduplication ---
  const batchUnique = [];
  const batchUrls = new Set();
  const batchCompanyTitles = new Set();

  for (const job of incoming) {
    const urlKey = normalizeApplyUrl(job.applyUrl);
    const ctKey = companyTitleKey(job.company, job.title);

    if (
      (urlKey && batchUrls.has(urlKey)) ||
      (ctKey !== "::" && batchCompanyTitles.has(ctKey))
    ) {
      duplicateCount += 1;
      continue;
    }

    if (urlKey) batchUrls.add(urlKey);
    if (ctKey !== "::") batchCompanyTitles.add(ctKey);
    batchUnique.push(job);
  }

  // --- Step B: database deduplication (last 30 days) ---
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const existing = await prisma.job.findMany({
    where: {
      OR: [{ scrapedAt: { gte: since } }, { createdAt: { gte: since } }],
    },
    select: {
      applyUrl: true,
      company: true,
      title: true,
      description: true,
    },
  });

  const existingUrls = new Set(
    existing.map((row) => normalizeApplyUrl(row.applyUrl)).filter(Boolean)
  );
  const existingCompanyTitles = new Set(
    existing.map((row) => companyTitleKey(row.company, row.title))
  );

  /** @type {Map<string, string[]>} */
  const descriptionsByCompany = new Map();
  for (const row of existing) {
    const key = String(row.company || "")
      .trim()
      .toLowerCase();
    if (!key) continue;
    if (!descriptionsByCompany.has(key)) descriptionsByCompany.set(key, []);
    if (row.description) {
      descriptionsByCompany.get(key).push(row.description);
    }
  }

  // --- Step C: filter + description similarity threshold ---
  const uniqueJobs = [];

  for (const job of batchUnique) {
    const urlKey = normalizeApplyUrl(job.applyUrl);
    const ctKey = companyTitleKey(job.company, job.title);

    if (
      (urlKey && existingUrls.has(urlKey)) ||
      (ctKey !== "::" && existingCompanyTitles.has(ctKey))
    ) {
      duplicateCount += 1;
      continue;
    }

    const companyKey = String(job.company || "")
      .trim()
      .toLowerCase();
    const peers = descriptionsByCompany.get(companyKey) || [];
    let isSimilar = false;

    for (const peerDescription of peers) {
      if (
        calculateSimilarity(job.description || "", peerDescription) >
        SIMILARITY_THRESHOLD
      ) {
        isSimilar = true;
        break;
      }
    }

    // Also compare against uniques already accepted in this pass (same company).
    if (!isSimilar) {
      for (const kept of uniqueJobs) {
        if (
          String(kept.company || "")
            .trim()
            .toLowerCase() !== companyKey
        ) {
          continue;
        }
        if (
          calculateSimilarity(job.description || "", kept.description || "") >
          SIMILARITY_THRESHOLD
        ) {
          isSimilar = true;
          break;
        }
      }
    }

    if (isSimilar) {
      duplicateCount += 1;
      continue;
    }

    uniqueJobs.push(job);

    // Track newly accepted keys so later batch items collide correctly vs DB-miss cases.
    if (urlKey) existingUrls.add(urlKey);
    if (ctKey !== "::") existingCompanyTitles.add(ctKey);
    if (companyKey && job.description) {
      if (!descriptionsByCompany.has(companyKey)) {
        descriptionsByCompany.set(companyKey, []);
      }
      descriptionsByCompany.get(companyKey).push(job.description);
    }
  }

  return { uniqueJobs, duplicateCount };
}
