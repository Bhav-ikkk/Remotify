import { prisma } from "../database.js";
import { getSetting, SETTING_KEYS } from "../settings.js";
import { sendOpsAlert } from "../telegram/alerts.js";
import { canAutoSubmit, detectAtsType } from "./ats.js";
import { ensureApplicationIdentity } from "./identity.js";

export const DEFAULT_DAILY_QUOTA = 35;
export const DEFAULT_APPLY_MIN_SCORE = 75;

/**
 * Stable key for syndicated postings (host + path without query/hash).
 * @param {string} applyUrl
 */
export function normalizeApplyKey(applyUrl) {
  try {
    const u = new URL(String(applyUrl || "").trim());
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return `${host}${path}`.toLowerCase();
  } catch {
    return String(applyUrl || "").trim().toLowerCase();
  }
}

/**
 * @returns {Promise<{
 *   enabled: boolean,
 *   quota: number,
 *   minScore: number,
 *   emailTo: string,
 *   preferAutoAts: boolean,
 * }>}
 */
export async function getApplyConfig() {
  const [enabledRaw, quotaRaw, minRaw, emailRaw, preferRaw] = await Promise.all([
    getSetting(SETTING_KEYS.APPLY_ENABLED),
    getSetting(SETTING_KEYS.DAILY_APPLY_QUOTA),
    getSetting(SETTING_KEYS.APPLY_MIN_SCORE),
    getSetting(SETTING_KEYS.APPLY_EMAIL_TO),
    getSetting(SETTING_KEYS.APPLY_PREFER_AUTO_ATS),
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

  // Must be explicitly configured (DB setting or APPLY_EMAIL_TO env).
  // Email senders fail closed when empty — no hardcoded fallback address.
  const emailTo =
    (typeof emailRaw === "string" && emailRaw.trim()) ||
    String(process.env.APPLY_EMAIL_TO || "").trim() ||
    "";

  const preferAutoAts =
    typeof preferRaw === "boolean"
      ? preferRaw
      : preferRaw === undefined
        ? true
        : Boolean(preferRaw);

  return { enabled, quota, minScore, emailTo, preferAutoAts };
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
 * When preferAutoAts is on, Greenhouse/Lever/Ashby fill quota before unknown ATS.
 * @param {{ limit?: number }} [options]
 */
export async function enqueueEligibleJobs(options = {}) {
  try {
    await ensureApplicationIdentity();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await sendOpsAlert(`Apply enqueue halted — identity unavailable: ${message}`);
    return {
      enabled: false,
      enqueued: 0,
      remaining: 0,
      reason: "identity_unavailable",
      error: message,
    };
  }
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
  const usedKeys = new Set(
    existing.map((e) => normalizeApplyKey(e.applyUrl)).filter(Boolean)
  );

  const candidates = await prisma.job.findMany({
    where: {
      aiScore: { gte: config.minScore },
      applyUrl: { not: "" },
    },
    orderBy: [{ aiScore: "desc" }, { scrapedAt: "desc" }],
    take: Math.max(take * 8, 40),
  });

  const withAts = candidates.map((job) => ({
    job,
    atsType: detectAtsType(job.applyUrl),
    key: normalizeApplyKey(job.applyUrl),
  }));

  const autoFirst = withAts.filter((c) => canAutoSubmit(c.atsType));
  const other = withAts.filter((c) => !canAutoSubmit(c.atsType));

  let enqueued = 0;
  let enqueuedAuto = 0;
  let enqueuedOther = 0;

  /**
   * @param {typeof withAts} list
   */
  async function enqueueFrom(list) {
    let local = 0;
    for (const { job, atsType, key } of list) {
      if (enqueued >= take) break;
      if (usedJobIds.has(job.id) || usedUrls.has(job.applyUrl)) continue;
      if (key && usedKeys.has(key)) continue;

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
        local += 1;
        if (canAutoSubmit(atsType)) enqueuedAuto += 1;
        else enqueuedOther += 1;
        usedJobIds.add(job.id);
        usedUrls.add(job.applyUrl);
        if (key) usedKeys.add(key);
      } catch (error) {
        console.warn(
          "[apply:queue] skip create:",
          error instanceof Error ? error.message : error
        );
      }
    }
    return local;
  }

  if (config.preferAutoAts) {
    await enqueueFrom(autoFirst);
    if (enqueued < take) await enqueueFrom(other);
  } else {
    const interleaved = [...withAts].sort(
      (a, b) =>
        Number(canAutoSubmit(b.atsType)) - Number(canAutoSubmit(a.atsType)) ||
        (b.job.aiScore || 0) - (a.job.aiScore || 0)
    );
    await enqueueFrom(interleaved);
  }

  return {
    enabled: true,
    enqueued,
    enqueuedAuto,
    enqueuedOther,
    preferAutoAts: config.preferAutoAts,
    remaining: Math.max(0, remaining - enqueued),
    quota: config.quota,
    used,
    minScore: config.minScore,
  };
}

/**
 * Claim next queued application for a worker.
 * Prefers auto-submit ATS when preferAutoAts is enabled.
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

  let next = null;
  if (config.preferAutoAts) {
    next = await prisma.application.findFirst({
      where: {
        status: "queued",
        atsType: { in: ["greenhouse", "lever", "ashby"] },
      },
      orderBy: [{ aiScore: "desc" }, { createdAt: "asc" }],
      include: { job: true },
    });
  }
  if (!next) {
    next = await prisma.application.findFirst({
      where: { status: "queued" },
      orderBy: [{ aiScore: "desc" }, { createdAt: "asc" }],
      include: { job: true },
    });
  }

  if (!next) {
    return { claimed: false, reason: "queue_empty" };
  }

  // Resolve identity before claiming: if the master resume is missing the
  // application must not leave "queued", and the failure must be loud.
  let identity;
  try {
    identity = await ensureApplicationIdentity();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await sendOpsAlert(`Apply claim refused — identity unavailable: ${message}`);
    return { claimed: false, reason: "identity_unavailable", error: message };
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

  const [
    queued,
    preparing,
    submittedToday,
    needsReview,
    failedToday,
    total,
    queuedAuto,
    submittedAll,
  ] = await Promise.all([
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
    prisma.application.count({
      where: {
        status: "queued",
        atsType: { in: ["greenhouse", "lever", "ashby"] },
      },
    }),
    prisma.application.count({ where: { status: "submitted" } }),
  ]);

  const used = await countQuotaUsedToday();
  const responseRate =
    total > 0 ? Math.round((submittedAll / total) * 1000) / 10 : 0;

  return {
    enabled: config.enabled,
    quota: config.quota,
    used,
    remaining: Math.max(0, config.quota - used),
    minScore: config.minScore,
    emailTo: config.emailTo,
    preferAutoAts: config.preferAutoAts,
    queued,
    queuedAuto,
    preparing,
    submittedToday,
    needsReview,
    failedToday,
    total,
    submittedAll,
    responseRate,
  };
}

/**
 * Build Telegram daily digest lines for apply funnel.
 */
export async function buildApplyDigestText() {
  const s = await getApplyStatusSummary();
  const skippedLow = await prisma.job.count({
    where: {
      aiScore: { not: null, lt: s.minScore },
      scrapedAt: { gte: startOfUtcDay() },
    },
  });

  return [
    "<b>Remotify apply digest</b>",
    `Auto-applied (submitted today): <b>${s.submittedToday}</b>`,
    `Need your click (needs_review): <b>${s.needsReview}</b>`,
    `Queued (auto ATS): <b>${s.queuedAuto}</b> · all queued: ${s.queued}`,
    `Quota: <b>${s.used}/${s.quota}</b> · prefer auto ATS: ${s.preferAutoAts ? "on" : "off"}`,
    `Failed today: ${s.failedToday}`,
    `Low-score skipped today: ${skippedLow} (min ${s.minScore})`,
    `CRM submit rate: ${s.responseRate}% (${s.submittedAll}/${s.total})`,
    "",
    "Worker: <code>npm run apply:worker</code> · /approvals · /apply_status",
  ].join("\n");
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
