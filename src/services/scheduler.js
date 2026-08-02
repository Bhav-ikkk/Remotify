import { prisma } from "@/services/database";

const DEFAULT_NAME = "default";

/**
 * Ensure a default scheduler row exists and return it.
 */
export async function getSchedulerConfig() {
  return prisma.schedulerConfig.upsert({
    where: { name: DEFAULT_NAME },
    create: {
      name: DEFAULT_NAME,
      isEnabled: false,
      isRunning: false,
    },
    update: {},
  });
}

/**
 * Update scheduler flags and runtime fields.
 * @param {{
 *   isEnabled?: boolean,
 *   targetHourUtc?: number | null,
 *   cronExpression?: string | null,
 *   nextRunAt?: string | Date | null,
 * }} payload
 */
export async function updateSchedulerConfig(payload) {
  const data = {};

  if (typeof payload.isEnabled === "boolean") {
    data.isEnabled = payload.isEnabled;
  }
  if (payload.targetHourUtc === null) {
    data.targetHourUtc = null;
  } else if (typeof payload.targetHourUtc === "number") {
    data.targetHourUtc = payload.targetHourUtc;
  }
  if (payload.cronExpression === null) {
    data.cronExpression = null;
  } else if (typeof payload.cronExpression === "string") {
    data.cronExpression = payload.cronExpression;
  }
  if (payload.nextRunAt === null) {
    data.nextRunAt = null;
  } else if (payload.nextRunAt !== undefined) {
    data.nextRunAt = new Date(payload.nextRunAt);
  }

  // When enabling with a target hour, compute a provisional nextRunAt if missing.
  if (data.isEnabled === true && data.nextRunAt === undefined) {
    const current = await getSchedulerConfig();
    const hour =
      typeof data.targetHourUtc === "number"
        ? data.targetHourUtc
        : current.targetHourUtc;

    if (typeof hour === "number") {
      data.nextRunAt = computeNextRunAt(hour);
    }
  }

  return prisma.schedulerConfig.upsert({
    where: { name: DEFAULT_NAME },
    create: {
      name: DEFAULT_NAME,
      isEnabled: data.isEnabled ?? false,
      isRunning: false,
      targetHourUtc: data.targetHourUtc ?? null,
      cronExpression: data.cronExpression ?? null,
      nextRunAt: data.nextRunAt ?? null,
    },
    update: data,
  });
}

/**
 * @param {number} hourUtc 0–23
 * @returns {Date}
 */
export function computeNextRunAt(hourUtc) {
  const now = new Date();
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      hourUtc,
      0,
      0,
      0
    )
  );
  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

/**
 * Serialize scheduler config for API clients.
 * @param {Awaited<ReturnType<typeof getSchedulerConfig>>} config
 */
export function serializeScheduler(config) {
  return {
    id: config.id,
    name: config.name,
    isEnabled: config.isEnabled,
    isRunning: config.isRunning,
    targetHourUtc: config.targetHourUtc,
    cronExpression: config.cronExpression,
    lastRunAt: config.lastRunAt ? config.lastRunAt.toISOString() : null,
    nextRunAt: config.nextRunAt ? config.nextRunAt.toISOString() : null,
    lastRunStatus: config.lastRunStatus,
    statusLabel: config.isRunning
      ? "running"
      : config.isEnabled
        ? "active"
        : "disabled",
  };
}

/**
 * Mark the default scheduler as currently executing.
 */
export async function markSchedulerRunning() {
  await getSchedulerConfig();
  return prisma.schedulerConfig.update({
    where: { name: DEFAULT_NAME },
    data: {
      isRunning: true,
      lastRunStatus: "running",
    },
  });
}

/**
 * Return scheduler to idle and stamp last/next run metadata.
 * @param {{ status: string, targetHourUtc?: number | null }} params
 */
export async function markSchedulerIdle({ status, targetHourUtc = null }) {
  const current = await getSchedulerConfig();
  const hour =
    typeof targetHourUtc === "number" ? targetHourUtc : current.targetHourUtc;

  return prisma.schedulerConfig.update({
    where: { name: DEFAULT_NAME },
    data: {
      isRunning: false,
      lastRunAt: new Date(),
      lastRunStatus: status,
      nextRunAt: typeof hour === "number" ? computeNextRunAt(hour) : null,
    },
  });
}

/**
 * Whether an hourly cron ping should launch the pipeline now.
 * @param {Awaited<ReturnType<typeof getSchedulerConfig>>} config
 * @param {Date} [now]
 */
export function shouldRunScheduledPipeline(config, now = new Date()) {
  if (!config?.isEnabled) return false;
  if (config.isRunning) return false;
  if (typeof config.targetHourUtc !== "number") return false;
  if (now.getUTCHours() !== config.targetHourUtc) return false;

  if (config.lastRunAt) {
    const last = new Date(config.lastRunAt);
    const sameHourWindow =
      last.getUTCFullYear() === now.getUTCFullYear() &&
      last.getUTCMonth() === now.getUTCMonth() &&
      last.getUTCDate() === now.getUTCDate() &&
      last.getUTCHours() === config.targetHourUtc;
    if (sameHourWindow) return false;
  }

  return true;
}
