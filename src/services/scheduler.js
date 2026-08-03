import { prisma } from "@/services/database";

const DEFAULT_NAME = "default";

/** ~08:00 IST and ~18:00 IST (Hobby cron fires sometime within the UTC hour). */
export const DEFAULT_TARGET_HOURS_UTC = [2, 12];

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
      targetHourUtc: DEFAULT_TARGET_HOURS_UTC[0],
      cronExpression: encodeTargetHours(DEFAULT_TARGET_HOURS_UTC),
    },
    update: {},
  });
}

/**
 * Update scheduler flags and runtime fields.
 * @param {{
 *   isEnabled?: boolean,
 *   targetHourUtc?: number | null,
 *   eveningHourUtc?: number | null,
 *   targetHoursUtc?: number[] | null,
 *   cronExpression?: string | null,
 *   nextRunAt?: string | Date | null,
 * }} payload
 */
export async function updateSchedulerConfig(payload) {
  const data = {};

  if (typeof payload.isEnabled === "boolean") {
    data.isEnabled = payload.isEnabled;
  }

  const hoursFromPayload = normalizeTargetHours(
    payload.targetHoursUtc ??
      (payload.targetHourUtc !== undefined ||
      payload.eveningHourUtc !== undefined
        ? [
            payload.targetHourUtc,
            payload.eveningHourUtc ?? DEFAULT_TARGET_HOURS_UTC[1],
          ]
        : null)
  );

  if (hoursFromPayload) {
    data.targetHourUtc = hoursFromPayload[0];
    data.cronExpression = encodeTargetHours(hoursFromPayload);
  } else if (payload.targetHourUtc === null) {
    data.targetHourUtc = null;
  } else if (typeof payload.targetHourUtc === "number") {
    data.targetHourUtc = payload.targetHourUtc;
  }

  if (payload.cronExpression === null) {
    data.cronExpression = null;
  } else if (
    typeof payload.cronExpression === "string" &&
    !hoursFromPayload
  ) {
    data.cronExpression = payload.cronExpression;
    const parsed = parseTargetHours(payload.cronExpression);
    if (parsed?.length) {
      data.targetHourUtc = parsed[0];
    }
  }

  if (payload.nextRunAt === null) {
    data.nextRunAt = null;
  } else if (payload.nextRunAt !== undefined) {
    data.nextRunAt = new Date(payload.nextRunAt);
  }

  if (data.isEnabled === true && data.nextRunAt === undefined) {
    const current = await getSchedulerConfig();
    const hours =
      hoursFromPayload ||
      resolveTargetHours({ ...current, ...data });
    data.nextRunAt = computeNextRunAtFromHours(hours);
  }

  return prisma.schedulerConfig.upsert({
    where: { name: DEFAULT_NAME },
    create: {
      name: DEFAULT_NAME,
      isEnabled: data.isEnabled ?? false,
      isRunning: false,
      targetHourUtc: data.targetHourUtc ?? DEFAULT_TARGET_HOURS_UTC[0],
      cronExpression:
        data.cronExpression ?? encodeTargetHours(DEFAULT_TARGET_HOURS_UTC),
      nextRunAt: data.nextRunAt ?? null,
    },
    update: data,
  });
}

/**
 * @param {number[]} hoursUtc
 * @returns {string}
 */
export function encodeTargetHours(hoursUtc) {
  return normalizeTargetHours(hoursUtc)?.join(",") ?? "";
}

/**
 * @param {unknown} value
 * @returns {number[] | null}
 */
export function parseTargetHours(value) {
  if (Array.isArray(value)) {
    return normalizeTargetHours(value);
  }
  if (typeof value !== "string" || !value.trim()) return null;
  if (!/^\d{1,2}(\s*,\s*\d{1,2})+$/.test(value.trim()) && !/^\d{1,2}$/.test(value.trim())) {
    return null;
  }
  return normalizeTargetHours(value.split(",").map((part) => Number(part.trim())));
}

/**
 * @param {unknown} hours
 * @returns {number[] | null}
 */
export function normalizeTargetHours(hours) {
  if (!Array.isArray(hours) || hours.length === 0) return null;
  const cleaned = [
    ...new Set(
      hours
        .map((h) => (typeof h === "number" ? h : Number(h)))
        .filter((h) => Number.isInteger(h) && h >= 0 && h <= 23)
    ),
  ].sort((a, b) => a - b);
  return cleaned.length ? cleaned : null;
}

/**
 * @param {{ targetHourUtc?: number | null, cronExpression?: string | null }} config
 * @returns {number[]}
 */
export function resolveTargetHours(config) {
  const fromExpression = parseTargetHours(config?.cronExpression);
  if (fromExpression?.length) return fromExpression;
  if (typeof config?.targetHourUtc === "number") {
    return [config.targetHourUtc];
  }
  return [...DEFAULT_TARGET_HOURS_UTC];
}

/**
 * @param {number} hourUtc 0–23
 * @returns {Date}
 */
export function computeNextRunAt(hourUtc) {
  return computeNextRunAtFromHours([hourUtc]);
}

/**
 * Next fire time among one or more UTC hours.
 * @param {number[]} hoursUtc
 * @param {Date} [now]
 * @returns {Date | null}
 */
export function computeNextRunAtFromHours(hoursUtc, now = new Date()) {
  const hours = normalizeTargetHours(hoursUtc);
  if (!hours?.length) return null;

  /** @type {Date | null} */
  let best = null;
  for (const hourUtc of hours) {
    const candidate = new Date(
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
    if (candidate <= now) {
      candidate.setUTCDate(candidate.getUTCDate() + 1);
    }
    if (!best || candidate < best) best = candidate;
  }
  return best;
}

/**
 * Serialize scheduler config for API clients.
 * @param {Awaited<ReturnType<typeof getSchedulerConfig>>} config
 */
export function serializeScheduler(config) {
  const targetHoursUtc = resolveTargetHours(config);
  return {
    id: config.id,
    name: config.name,
    isEnabled: config.isEnabled,
    isRunning: config.isRunning,
    targetHourUtc: targetHoursUtc[0] ?? config.targetHourUtc,
    eveningHourUtc: targetHoursUtc[1] ?? null,
    targetHoursUtc,
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
 * @param {{ status: string, targetHourUtc?: number | null, targetHoursUtc?: number[] | null }} params
 */
export async function markSchedulerIdle({
  status,
  targetHourUtc = null,
  targetHoursUtc = null,
}) {
  const current = await getSchedulerConfig();
  const hours =
    normalizeTargetHours(targetHoursUtc) ||
    (typeof targetHourUtc === "number"
      ? resolveTargetHours({
          ...current,
          targetHourUtc,
        })
      : resolveTargetHours(current));

  return prisma.schedulerConfig.update({
    where: { name: DEFAULT_NAME },
    data: {
      isRunning: false,
      lastRunAt: new Date(),
      lastRunStatus: status,
      nextRunAt: computeNextRunAtFromHours(hours),
    },
  });
}

/**
 * Whether a Vercel cron ping should launch the pipeline now.
 * Supports two Hobby-safe daily windows (morning + evening UTC hours).
 * @param {Awaited<ReturnType<typeof getSchedulerConfig>>} config
 * @param {Date} [now]
 */
export function shouldRunScheduledPipeline(config, now = new Date()) {
  if (!config?.isEnabled) return false;
  if (config.isRunning) return false;

  const hours = resolveTargetHours(config);
  const currentHour = now.getUTCHours();
  if (!hours.includes(currentHour)) return false;

  if (config.lastRunAt) {
    const last = new Date(config.lastRunAt);
    const sameHourWindow =
      last.getUTCFullYear() === now.getUTCFullYear() &&
      last.getUTCMonth() === now.getUTCMonth() &&
      last.getUTCDate() === now.getUTCDate() &&
      last.getUTCHours() === currentHour;
    if (sameHourWindow) return false;
  }

  return true;
}
