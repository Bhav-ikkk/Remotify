import ExcelJS from "exceljs";
import { prisma } from "../database.js";
import { getSetting, SETTING_KEYS } from "../settings.js";

/**
 * @typedef {'all' | 'matches'} GrabMode
 */

/**
 * Query jobs that still look apply-able (have URL, recent scrape window).
 * @param {{
 *   mode?: GrabMode,
 *   days?: number,
 *   minScore?: number,
 *   limit?: number,
 * }} [options]
 */
export async function queryGrabJobs(options = {}) {
  const mode = options.mode === "matches" ? "matches" : "all";
  const days =
    typeof options.days === "number" && options.days > 0 ? options.days : 30;
  const limit =
    typeof options.limit === "number" && options.limit > 0
      ? Math.min(options.limit, 2000)
      : 500;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  /** @type {import('@prisma/client').Prisma.JobWhereInput} */
  const where = {
    scrapedAt: { gte: since },
    applyUrl: { not: "" },
  };

  if (mode === "matches") {
    const configured = await getSetting(SETTING_KEYS.MIN_MATCH_SCORE);
    const minScore =
      typeof options.minScore === "number"
        ? options.minScore
        : typeof configured === "number"
          ? configured
          : 70;
    where.aiScore = { gte: minScore };
  }

  const jobs = await prisma.job.findMany({
    where,
    orderBy: [{ aiScore: "desc" }, { scrapedAt: "desc" }],
    take: limit,
  });

  return { mode, days, since, jobs };
}

/**
 * Build an .xlsx buffer for Telegram sendDocument.
 * @param {Array<object>} jobs
 * @param {{ mode?: GrabMode, title?: string }} [meta]
 * @returns {Promise<Buffer>}
 */
export async function buildJobsExcelBuffer(jobs, meta = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Remotify";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(meta.mode === "matches" ? "Matches" : "All Leads", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Score", key: "score", width: 8 },
    { header: "Title", key: "title", width: 36 },
    { header: "Company", key: "company", width: 24 },
    { header: "Location", key: "location", width: 18 },
    { header: "Salary", key: "salary", width: 16 },
    { header: "Source", key: "source", width: 14 },
    { header: "Matched Skills", key: "matched", width: 28 },
    { header: "Missing Skills", key: "missing", width: 28 },
    { header: "Reason", key: "reason", width: 40 },
    { header: "Apply URL", key: "applyUrl", width: 42 },
    { header: "Scraped At", key: "scrapedAt", width: 20 },
    { header: "Posted Date", key: "postedDate", width: 14 },
  ];

  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8EEF5" },
  };

  for (const job of jobs) {
    sheet.addRow({
      score:
        typeof job.aiScore === "number" && Number.isFinite(job.aiScore)
          ? Math.round(job.aiScore)
          : "",
      title: job.title || "",
      company: job.company || "",
      location: job.location || "",
      salary: job.salary
        ? job.currency
          ? `${job.salary} ${job.currency}`
          : job.salary
        : "",
      source: job.sourceWebsite || "",
      matched: Array.isArray(job.aiMatchedSkills)
        ? job.aiMatchedSkills.join(", ")
        : "",
      missing: Array.isArray(job.aiMissingSkills)
        ? job.aiMissingSkills.join(", ")
        : "",
      reason: job.aiReason || "",
      applyUrl: job.applyUrl || "",
      scrapedAt: job.scrapedAt ? new Date(job.scrapedAt).toISOString() : "",
      postedDate: job.postedDate
        ? new Date(job.postedDate).toISOString().slice(0, 10)
        : "",
    });
  }

  // Hyperlink apply URLs
  for (let i = 2; i <= sheet.rowCount; i += 1) {
    const cell = sheet.getCell(i, 10);
    const url = String(cell.value || "");
    if (url.startsWith("http")) {
      cell.value = { text: url, hyperlink: url };
      cell.font = { color: { argb: "FF0563C1" }, underline: true };
    }
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Filename for Telegram attachment.
 * @param {GrabMode} mode
 */
export function grabFilename(mode) {
  const stamp = new Date().toISOString().slice(0, 10);
  const label = mode === "matches" ? "matches" : "all-leads";
  return `remotify-${label}-${stamp}.xlsx`;
}
