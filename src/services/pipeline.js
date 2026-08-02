import { prisma } from "@/services/database";
import { getSetting, SETTING_KEYS } from "@/services/settings";
import {
  getSchedulerConfig,
  markSchedulerIdle,
  markSchedulerRunning,
} from "@/services/scheduler";
import { normalizeJob } from "@/normalizers/index.js";
import { filterDuplicates } from "@/utils/deduplicate.js";
import { processJobsWithAI } from "@/utils/ai-batch.js";
import { AIService, createGeminiProvider } from "@/services/ai/index.js";
import { sendTopMatches } from "@/services/notification";

import { scrape as scrapeSkipTheDrive } from "@/scrapers/skipthedrive.js";
import { scrape as scrapeBuiltIn } from "@/scrapers/builtin.js";
import { scrape as scrapeUnderdog } from "@/scrapers/underdog.js";
import { scrape as scrapeJobgether } from "@/scrapers/jobgether.js";
import { scrape as scrapeWellfound } from "@/scrapers/wellfound.js";

const SCRAPERS = [
  { name: "skipthedrive", run: scrapeSkipTheDrive },
  { name: "builtin", run: scrapeBuiltIn },
  { name: "underdog", run: scrapeUnderdog },
  { name: "jobgether", run: scrapeJobgether },
  { name: "wellfound", run: scrapeWellfound },
];

/**
 * End-to-end Remotify pipeline: scrape → normalize → dedupe → AI → persist → notify.
 * @param {boolean} [manualOverride=false] Bypass scheduler enabled check when true.
 */
export async function runPipeline(manualOverride = false) {
  const wallStarted = Date.now();
  const config = await getSchedulerConfig();

  if (!manualOverride && !config.isEnabled) {
    return {
      success: false,
      aborted: true,
      reason: "Scheduler is disabled.",
    };
  }

  if (config.isRunning) {
    return {
      success: false,
      aborted: true,
      reason: "Pipeline is already running.",
    };
  }

  await markSchedulerRunning();

  const run = await prisma.runHistory.create({
    data: {
      status: "running",
      startedAt: new Date(),
      sourcesTargeted: SCRAPERS.length,
    },
  });

  /** @type {unknown[]} */
  const errorLog = [];
  /** @type {unknown[]} */
  const notificationLog = [];
  let jobsParsed = 0;
  let jobsDeduplicated = 0;
  let jobsProcessed = 0;
  let jobsMatched = 0;
  let notificationsSent = 0;
  let status = "success";

  try {
    const maxJobs = await readNumberSetting(SETTING_KEYS.MAX_JOBS, 200);
    const minMatchScore = await readNumberSetting(
      SETTING_KEYS.MIN_MATCH_SCORE,
      85
    );
    const userProfile = await readStringSetting(
      SETTING_KEYS.TARGET_PROFILE,
      "Remote-friendly software engineer seeking full-stack JavaScript roles."
    );
    const apiKey = await resolveGeminiApiKey();

    // --- Scrape ---
    const settled = await Promise.allSettled(
      SCRAPERS.map(async (scraper) => {
        const jobs = await scraper.run();
        return {
          name: scraper.name,
          jobs: Array.isArray(jobs) ? jobs : [],
        };
      })
    );

    const rawJobs = [];
    for (let i = 0; i < settled.length; i += 1) {
      const result = settled[i];
      const name = SCRAPERS[i].name;
      if (result.status === "fulfilled") {
        rawJobs.push(...result.value.jobs);
      } else {
        const message =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        errorLog.push({ stage: "scrape", source: name, message });
        console.error(`[pipeline] scraper ${name} failed:`, message);
      }
    }
    jobsParsed = rawJobs.length;

    await patchRun(run.id, {
      jobsParsed,
      errorCount: errorLog.length,
      errors: errorLog,
      metrics: { stage: "scraped", jobsParsed },
    });

    // --- Normalize ---
    const normalized = [];
    for (const job of rawJobs) {
      try {
        normalized.push(normalizeJob(job));
      } catch (error) {
        errorLog.push({
          stage: "normalize",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // --- Deduplicate ---
    const { uniqueJobs, duplicateCount } = await filterDuplicates(normalized);
    jobsDeduplicated = duplicateCount;

    // --- Cap ---
    const capped = uniqueJobs.slice(0, Math.max(1, maxJobs));

    await patchRun(run.id, {
      jobsDeduplicated,
      errorCount: errorLog.length,
      errors: errorLog,
      metrics: {
        stage: "deduped",
        unique: uniqueJobs.length,
        capped: capped.length,
        maxJobs,
      },
    });

    // --- AI scoring (sequential + throttled) ---
    let scored = [];
    if (capped.length === 0) {
      scored = [];
    } else if (!apiKey) {
      errorLog.push({
        stage: "ai",
        message: "GEMINI_API_KEY missing — AI scoring skipped.",
      });
      status = "partial";
      scored = capped.map((job) => ({
        ...job,
        aiScore: 0,
        aiMatchedSkills: [],
        aiMissingSkills: [],
        aiReason: "AI scoring skipped — API key not configured.",
        aiRawResponse: null,
      }));
    } else {
      const aiService = new AIService(createGeminiProvider({ apiKey }));
      scored = await processJobsWithAI(capped, userProfile, 1000, {
        aiService,
      });
      const aiFailures = scored.filter((job) =>
        String(job.aiReason || "").includes("AI evaluation failed")
      ).length;
      if (aiFailures > 0) {
        errorLog.push({
          stage: "ai",
          message: `${aiFailures}/${scored.length} jobs failed AI evaluation.`,
        });
        status = "partial";
      }
    }
    jobsProcessed = scored.length;

    await patchRun(run.id, {
      jobsProcessed,
      errorCount: errorLog.length,
      errors: errorLog,
      metrics: { stage: "scored", jobsProcessed },
    });

    // --- Persist ---
    let persisted = 0;
    for (const job of scored) {
      try {
        await prisma.job.upsert({
          where: { applyUrl: job.applyUrl },
          create: toJobCreate(job),
          update: toJobUpdate(job),
        });
        persisted += 1;
      } catch (error) {
        errorLog.push({
          stage: "persist",
          applyUrl: job.applyUrl,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // --- Notify top matches ---
    const topMatches = await prisma.job.findMany({
      where: {
        aiScore: { gte: minMatchScore },
        isNotified: false,
      },
      orderBy: { aiScore: "desc" },
      take: 5,
    });
    jobsMatched = topMatches.length;

    if (topMatches.length > 0) {
      try {
        const notifyResult = await sendTopMatches(topMatches);
        notificationsSent = notifyResult.sent || 0;
        notificationLog.push(notifyResult);
        if (notifyResult.failed > 0) status = "partial";

        if (Array.isArray(notifyResult.deliveredIds) && notifyResult.deliveredIds.length > 0) {
          await prisma.job.updateMany({
            where: { id: { in: notifyResult.deliveredIds } },
            data: { isNotified: true },
          });
        }
      } catch (error) {
        status = "partial";
        const message =
          error instanceof Error ? error.message : String(error);
        errorLog.push({ stage: "notify", message });
        notificationLog.push({ status: "failed", message });
      }
    }

    if (errorLog.length > 0 && status === "success") {
      status = "partial";
    }

    const durationMs = Date.now() - wallStarted;
    await prisma.runHistory.update({
      where: { id: run.id },
      data: {
        status,
        finishedAt: new Date(),
        durationMs,
        jobsParsed,
        jobsDeduplicated,
        jobsProcessed,
        jobsMatched,
        notificationsSent,
        errorCount: errorLog.length,
        errors: errorLog,
        notificationLog,
        metrics: {
          persisted,
          uniqueAfterDedupe: uniqueJobs.length,
          capped: capped.length,
          maxJobs,
          minMatchScore,
        },
      },
    });

    await markSchedulerIdle({
      status,
      targetHourUtc: config.targetHourUtc,
    });

    return {
      success: status !== "failed",
      aborted: false,
      runId: run.id,
      status,
      durationMs,
      jobsParsed,
      jobsDeduplicated,
      jobsProcessed,
      jobsMatched,
      notificationsSent,
      persisted,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[pipeline] fatal:", message);
    errorLog.push({ stage: "fatal", message });

    await prisma.runHistory
      .update({
        where: { id: run.id },
        data: {
          status: "failed",
          finishedAt: new Date(),
          durationMs: Date.now() - wallStarted,
          jobsParsed,
          jobsDeduplicated,
          jobsProcessed,
          jobsMatched,
          notificationsSent,
          errorCount: errorLog.length,
          errors: errorLog,
          notificationLog,
        },
      })
      .catch(() => {});

    await markSchedulerIdle({
      status: "failed",
      targetHourUtc: config.targetHourUtc,
    }).catch(() => {});

    return {
      success: false,
      aborted: false,
      runId: run.id,
      status: "failed",
      reason: message,
    };
  }
}

/**
 * @param {string} id
 * @param {object} data
 */
async function patchRun(id, data) {
  await prisma.runHistory.update({ where: { id }, data }).catch((error) => {
    console.error(
      "[pipeline] runHistory patch failed:",
      error instanceof Error ? error.message : error
    );
  });
}

/**
 * @param {string} key
 * @param {number} fallback
 */
async function readNumberSetting(key, fallback) {
  const value = await getSetting(key);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * @param {string} key
 * @param {string} fallback
 */
async function readStringSetting(key, fallback) {
  const value = await getSetting(key);
  return typeof value === "string" && value.trim() ? value : fallback;
}

async function resolveGeminiApiKey() {
  const envKey = String(process.env.GEMINI_API_KEY || "").trim();
  const fromDb = await getSetting(SETTING_KEYS.AI_API_KEY);
  const dbKey = typeof fromDb === "string" ? fromDb.trim() : "";

  // Prefer runtime env; ignore obvious placeholder DB values.
  if (envKey) return envKey;
  if (dbKey && !/test-gemini|changeme|your.?key|placeholder/i.test(dbKey)) {
    return dbKey;
  }
  return dbKey || "";
}

/**
 * @param {object} job
 */
function toJobCreate(job) {
  const remoteToken = job.location || null;
  return {
    title: job.title,
    company: job.company,
    location: job.location || "Remote",
    isRemote: /remote/i.test(String(job.location || "")),
    remoteToken,
    salary: job.salary,
    currency: job.currency,
    employmentType: job.employmentType,
    experience: job.experience,
    description: job.description,
    skills: Array.isArray(job.skills) ? job.skills : [],
    applyUrl: job.applyUrl,
    companyUrl: job.companyUrl,
    sourceWebsite: job.sourceWebsite,
    postedDate: job.postedDate instanceof Date ? job.postedDate : null,
    scrapedAt: job.scrapedAt instanceof Date ? job.scrapedAt : new Date(),
    aiScore: typeof job.aiScore === "number" ? job.aiScore : null,
    aiMatchedSkills: Array.isArray(job.aiMatchedSkills)
      ? job.aiMatchedSkills
      : [],
    aiMissingSkills: Array.isArray(job.aiMissingSkills)
      ? job.aiMissingSkills
      : [],
    aiReason: job.aiReason || null,
    aiRawResponse: job.aiRawResponse ?? null,
    isNotified: false,
  };
}

/**
 * @param {object} job
 */
function toJobUpdate(job) {
  const base = toJobCreate(job);
  delete base.applyUrl;
  delete base.isNotified;
  return base;
}
