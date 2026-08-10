import { prisma } from "../database.js";
import { getSetting, SETTING_KEYS } from "../settings.js";
import { detectAtsType } from "./ats.js";
import { ensureApplicationIdentity } from "./identity.js";

export const DEFAULT_DAILY_QUOTA = 35;
export const DEFAULT_APPLY_MIN_SCORE = 75;

/**
 * @returns {Promise<{ enabled: boolean, quota: number, minScore: number, emailTo: string }>}
 */
export async function getApplyConfig() {
  const [enabledRaw, quotaRaw, minRaw, emailRaw] = await Promise.all([
    getSetting(SETTING_KEYS.APPLY_ENABLED),
    getSetting(SETTING_KEYS.DAILY_APPLY_QUOTA),
    getSetting(SETTING_KEYS.APPLY_MIN_SCORE),
    getSetting(SETTING_KEYS.APPLY_EMAIL_TO),
  ]);

  const enabled =
    typeof enabledRaw === "boolean"
      ? enabledRaw
      : enabledRaw === undefined
        ? true
        : Boolean(enabledRaw);

  const quota =
    typeof quotaRaw === "number" && Number.isFinite(quotaRaw)
      ? Math.max(1, Math.min(35, Math.floor(quotaRaw)))
      : DEFAULT_DAILY_QUOTA;

  const minScore =
    typeof minRaw === "number" && Number.isFinite(minRaw)
      ? minRaw
      : DEFAULT_APPLY_MIN_SCORE;

  const emailTo =
    typeof emailRaw === "string" && emailRaw.trim()
      ? emailRaw.trim()
      : "Bhavikkjoshiii@gmail.com";

  return { enabled, quota, minScore, emailTo };
}

/**
 * Start of "today" in UTC (consistent with cron).
 */
export function startOfUtcDay(date = new Date()) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

/**
 * Count applications that consume daily quota today.
 * submitted + needs_review count; queued do not until claimed/handled.
 */
export async function countQuotaUsedToday() {
  const since = startOfUtcDay();
  return prisma.application.count({
    where: {
      OR: [
        { submittedAt: { gte: since } },
        {
          status: { in: ["submitted", "needs_review", "failed"] },
          updatedAt: { gte: since },
        },
      ],
    },
  });
}

/**
 * Enqueue eligible scored jobs up to remaining daily quota.
 * @param {{ limit?: number }} [options]
 */
export async function enqueueEligibleJobs(options = {}) {
  await ensureApplicationIdentity();
  const config = await getApplyConfig();
  if (!config.enabled) {
    return { enabled: false, enqueued: 0, remaining: 0, reason: "apply_disabled" };
  }

  const used = await countQuotaUsedToday();
  const remaining = Math.max(0, config.quota - used);
  if (remaining <= 0) {
    return { enabled: true, enqueued: 0, remaining: 0, reason: "quota_exhausted" };
  }

  const take = Math.min(
    remaining,
    typeof options.limit === "number" ? options.limit : remaining
  );

  const existing = await prisma.application.findMany({
    select: { jobId: true, applyUrl: true },
  });
  const usedJobIds = new Set(existing.map((e) => e.jobId));
  const usedUrls = new Set(existing.map((e) => e.applyUrl));

  const candidates = await prisma.job.findMany({
    where: {
      aiScore: { gte: config.minScore },
      applyUrl: { not: "" },
    },
    orderBy: [{ aiScore: "desc" }, { scrapedAt: "desc" }],
    take: take * 3,
  });

  let enqueued = 0;
  for (const job of candidates) {
    if (enqueued >= take) break;
    if (usedJobIds.has(job.id) || usedUrls.has(job.applyUrl)) continue;

    const atsType = detectAtsType(job.applyUrl);
    try {
      await prisma.application.create({
        data: {
          jobId: job.id,
          applyUrl: job.applyUrl,
          atsType,
          status: "queued",
          aiScore: typeof job.aiScore === "number" ? job.aiScore : null,
        },
      });
      enqueued += 1;
      usedJobIds.add(job.id);
      usedUrls.add(job.applyUrl);
    } catch (error) {
      // Unique race — skip
      console.warn(
        "[apply:queue] skip create:",
        error instanceof Error ? error.message : error
      );
    }
  }

  return {
    enabled: true,
    enqueued,
    remaining: Math.max(0, remaining - enqueued),
    quota: config.quota,
    used,
    minScore: config.minScore,
  };
}

/**
 * Claim next queued application for a worker.
 * @param {{ workerId?: string }} [options]
 */
export async function claimNextApplication(options = {}) {
  const config = await getApplyConfig();
  if (!config.enabled) {
    return { claimed: false, reason: "apply_disabled" };
  }

  const used = await countQuotaUsedToday();
  if (used >= config.quota) {
    return { claimed: false, reason: "quota_exhausted", used, quota: config.quota };
  }

  const next = await prisma.application.findFirst({
    where: { status: "queued" },
    orderBy: [{ aiScore: "desc" }, { createdAt: "asc" }],
    include: {
      job: true,
    },
  });

  if (!next) {
    return { claimed: false, reason: "queue_empty" };
  }

  const workerId = options.workerId || `worker-${Date.now()}`;
  const updated = await prisma.application.update({
    where: { id: next.id },
    data: {
      status: "preparing",
      claimedAt: new Date(),
      workerId,
    },
    include: { job: true },
  });

  const identity = await ensureApplicationIdentity();

  return {
    claimed: true,
    application: updated,
    identity,
    config,
  };
}

/**
 * Worker reports outcome for a claimed application.
 * @param {{
 *   applicationId: string,
 *   status: string,
 *   formPayload?: object,
 *   error?: string,
 *   confirmationText?: string,
 *   resumeFileName?: string,
 *   resumeMeta?: object,
 * }} report
 */
export async function reportApplication(report) {
  const status = String(report.status || "").toLowerCase();
  const allowed = new Set([
    "submitted",
    "needs_review",
    "failed",
    "skipped",
    "queued",
  ]);
  if (!allowed.has(status)) {
    throw new Error(`Invalid report status: ${status}`);
  }

  const data = {
    status,
    formPayload: report.formPayload ?? undefined,
    error: report.error || null,
    confirmationText: report.confirmationText || null,
    resumeFileName: report.resumeFileName || undefined,
    resumeMeta: report.resumeMeta ?? undefined,
  };

  if (status === "submitted" || status === "needs_review") {
    data.submittedAt = new Date();
  }
  if (status === "queued") {
    data.claimedAt = null;
    data.workerId = null;
  }

  return prisma.application.update({
    where: { id: report.applicationId },
    data,
    include: { job: true },
  });
}

/**
 * Snapshot for dashboard / Telegram.
 */
export async function getApplyStatusSummary() {
  const config = await getApplyConfig();
  const since = startOfUtcDay();

  const [queued, preparing, submittedToday, needsReview, failedToday, total] =
    await Promise.all([
      prisma.application.count({ where: { status: "queued" } }),
      prisma.application.count({
        where: { status: { in: ["preparing", "submitting"] } },
      }),
      prisma.application.count({
        where: { status: "submitted", submittedAt: { gte: since } },
      }),
      prisma.application.count({ where: { status: "needs_review" } }),
      prisma.application.count({
        where: { status: "failed", updatedAt: { gte: since } },
      }),
      prisma.application.count(),
    ]);

  const used = await countQuotaUsedToday();

  return {
    enabled: config.enabled,
    quota: config.quota,
    used,
    remaining: Math.max(0, config.quota - used),
    minScore: config.minScore,
    emailTo: config.emailTo,
    queued,
    preparing,
    submittedToday,
    needsReview,
    failedToday,
    total,
  };
}

/**
 * List applications with job for UI.
 * @param {{ status?: string, take?: number }} [options]
 */
export async function listApplications(options = {}) {
  const where = {};
  if (options.status) where.status = options.status;

  return prisma.application.findMany({
    where,
    include: {
      job: {
        select: {
          id: true,
          title: true,
          company: true,
          location: true,
          applyUrl: true,
          aiScore: true,
          sourceWebsite: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: typeof options.take === "number" ? options.take : 100,
  });
}
