import { prisma } from "./database.js";

/** Operational defaults only — never secrets or credentials. */
export const SETTING_KEYS = {
  AI_API_KEY: "ai_api_key",
  TARGET_PROFILE: "target_profile",
  MAX_JOBS: "max_jobs",
  MIN_MATCH_SCORE: "min_match_score",
  TELEGRAM_BOT_TOKEN: "telegram_bot_token",
  TELEGRAM_CHAT_ID: "telegram_chat_id",
  ZYTE_API_KEY: "zyte_api_key",
  ZYTE_PROJECT_ID: "zyte_project_id",
  DAILY_APPLY_QUOTA: "daily_apply_quota",
  APPLY_MIN_SCORE: "apply_min_score",
  APPLY_ENABLED: "apply_enabled",
  APPLY_EMAIL_TO: "apply_email_to",
  APPLY_PREFER_AUTO_ATS: "apply_prefer_auto_ats",
  GMAIL_USER: "gmail_user",
  GMAIL_APP_PASSWORD: "gmail_app_password",
};

/**
 * Mask a secret for client responses. Empty values stay empty.
 * @param {unknown} value
 * @returns {string}
 */
export function maskSecret(value) {
  if (typeof value !== "string" || value.length === 0) return "";
  if (value.length <= 4) return "••••";
  return `${"•".repeat(Math.min(12, value.length - 4))}${value.slice(-4)}`;
}

/**
 * @param {unknown} raw
 * @returns {unknown}
 */
function unwrapJsonValue(raw) {
  return raw;
}

/**
 * Read a single setting by key.
 * @param {string} key
 * @returns {Promise<unknown>}
 */
export async function getSetting(key) {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row) return undefined;
  return unwrapJsonValue(row.value);
}

/**
 * Upsert a setting value (JSON-serializable).
 * @param {string} key
 * @param {unknown} value
 */
export async function setSetting(key, value) {
  return prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

/**
 * Batch upsert settings from a plain object of known keys.
 * Skips undefined fields. Empty string on sensitive keys clears them.
 * @param {Record<string, unknown>} updates
 */
export async function upsertSettings(updates) {
  const entries = Object.entries(updates).filter(([, v]) => v !== undefined);

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      })
    )
  );
}

/**
 * Probe Neon via a lightweight query.
 * @returns {Promise<{ ok: boolean, latencyMs: number, error?: string }>}
 */
export async function pingDatabase() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : "Database unreachable",
    };
  }
}

/**
 * Assemble the settings payload for the control panel.
 * Sensitive tokens are redacted; presence flags indicate configured secrets.
 * @param {{ redact?: boolean }} [options]
 */
export async function getAppSettings({ redact = true } = {}) {
  const keys = Object.values(SETTING_KEYS);
  const rows = await prisma.setting.findMany({
    where: { key: { in: keys } },
  });

  /** @type {Record<string, unknown>} */
  const map = {};
  for (const row of rows) {
    map[row.key] = unwrapJsonValue(row.value);
  }

  const aiKey = typeof map[SETTING_KEYS.AI_API_KEY] === "string"
    ? map[SETTING_KEYS.AI_API_KEY]
    : "";
  const botToken =
    typeof map[SETTING_KEYS.TELEGRAM_BOT_TOKEN] === "string"
      ? map[SETTING_KEYS.TELEGRAM_BOT_TOKEN]
      : "";
  const zyteApiKey =
    typeof map[SETTING_KEYS.ZYTE_API_KEY] === "string"
      ? map[SETTING_KEYS.ZYTE_API_KEY]
      : "";
  const zyteProjectIdRaw = map[SETTING_KEYS.ZYTE_PROJECT_ID];
  const zyteProjectId =
    typeof zyteProjectIdRaw === "string"
      ? zyteProjectIdRaw
      : typeof zyteProjectIdRaw === "number"
        ? String(zyteProjectIdRaw)
        : "";

  const maxJobsRaw = map[SETTING_KEYS.MAX_JOBS];
  const minScoreRaw = map[SETTING_KEYS.MIN_MATCH_SCORE];
  const applyQuotaRaw = map[SETTING_KEYS.DAILY_APPLY_QUOTA];
  const applyMinRaw = map[SETTING_KEYS.APPLY_MIN_SCORE];
  const applyEnabledRaw = map[SETTING_KEYS.APPLY_ENABLED];
  const preferAutoRaw = map[SETTING_KEYS.APPLY_PREFER_AUTO_ATS];
  const gmailPass =
    typeof map[SETTING_KEYS.GMAIL_APP_PASSWORD] === "string"
      ? map[SETTING_KEYS.GMAIL_APP_PASSWORD]
      : "";

  return {
    database: await pingDatabase(),
    ai: {
      apiKey: redact ? maskSecret(aiKey) : aiKey,
      apiKeyConfigured: Boolean(aiKey),
      targetProfile:
        typeof map[SETTING_KEYS.TARGET_PROFILE] === "string"
          ? map[SETTING_KEYS.TARGET_PROFILE]
          : "",
      maxJobs:
        typeof maxJobsRaw === "number" && Number.isFinite(maxJobsRaw)
          ? maxJobsRaw
          : 200,
      minMatchScore:
        typeof minScoreRaw === "number" && Number.isFinite(minScoreRaw)
          ? minScoreRaw
          : 85,
    },
    telegram: {
      botToken: redact ? maskSecret(botToken) : botToken,
      botTokenConfigured: Boolean(botToken),
      chatId:
        typeof map[SETTING_KEYS.TELEGRAM_CHAT_ID] === "string"
          ? map[SETTING_KEYS.TELEGRAM_CHAT_ID]
          : "",
    },
    zyte: {
      apiKey: redact ? maskSecret(zyteApiKey) : zyteApiKey,
      apiKeyConfigured: Boolean(zyteApiKey),
      projectId: zyteProjectId,
    },
    apply: {
      enabled:
        typeof applyEnabledRaw === "boolean" ? applyEnabledRaw : true,
      dailyQuota:
        typeof applyQuotaRaw === "number" && Number.isFinite(applyQuotaRaw)
          ? applyQuotaRaw
          : 35,
      minScore:
        typeof applyMinRaw === "number" && Number.isFinite(applyMinRaw)
          ? applyMinRaw
          : 75,
      preferAutoAts:
        typeof preferAutoRaw === "boolean" ? preferAutoRaw : true,
      emailTo:
        typeof map[SETTING_KEYS.APPLY_EMAIL_TO] === "string"
          ? map[SETTING_KEYS.APPLY_EMAIL_TO]
          : "",
      gmailUser:
        typeof map[SETTING_KEYS.GMAIL_USER] === "string"
          ? map[SETTING_KEYS.GMAIL_USER]
          : "",
      gmailAppPassword: redact ? maskSecret(gmailPass) : gmailPass,
      gmailConfigured: Boolean(gmailPass),
    },
  };
}

/**
 * Apply validated settings updates. Masked placeholder values are ignored
 * so a save without re-entering secrets preserves existing keys.
 * @param {{
 *   aiApiKey?: string,
 *   targetProfile?: string,
 *   maxJobs?: number,
 *   minMatchScore?: number,
 *   telegramBotToken?: string,
 *   telegramChatId?: string,
 *   zyteApiKey?: string,
 *   zyteProjectId?: string,
 *   applyEnabled?: boolean,
 *   dailyApplyQuota?: number,
 *   applyMinScore?: number,
 *   applyPreferAutoAts?: boolean,
 *   applyEmailTo?: string,
 *   gmailUser?: string,
 *   gmailAppPassword?: string,
 * }} payload
 */
export async function saveAppSettings(payload) {
  /** @type {Record<string, unknown>} */
  const updates = {};

  if (typeof payload.targetProfile === "string") {
    updates[SETTING_KEYS.TARGET_PROFILE] = payload.targetProfile;
  }
  if (typeof payload.maxJobs === "number") {
    updates[SETTING_KEYS.MAX_JOBS] = payload.maxJobs;
  }
  if (typeof payload.minMatchScore === "number") {
    updates[SETTING_KEYS.MIN_MATCH_SCORE] = payload.minMatchScore;
  }
  if (typeof payload.telegramChatId === "string") {
    updates[SETTING_KEYS.TELEGRAM_CHAT_ID] = payload.telegramChatId;
  }
  if (typeof payload.zyteProjectId === "string") {
    updates[SETTING_KEYS.ZYTE_PROJECT_ID] = payload.zyteProjectId.trim();
  }
  if (typeof payload.applyEnabled === "boolean") {
    updates[SETTING_KEYS.APPLY_ENABLED] = payload.applyEnabled;
  }
  if (typeof payload.dailyApplyQuota === "number") {
    updates[SETTING_KEYS.DAILY_APPLY_QUOTA] = Math.max(
      1,
      Math.min(35, Math.floor(payload.dailyApplyQuota))
    );
  }
  if (typeof payload.applyMinScore === "number") {
    updates[SETTING_KEYS.APPLY_MIN_SCORE] = payload.applyMinScore;
  }
  if (typeof payload.applyPreferAutoAts === "boolean") {
    updates[SETTING_KEYS.APPLY_PREFER_AUTO_ATS] = payload.applyPreferAutoAts;
  }
  if (typeof payload.applyEmailTo === "string") {
    updates[SETTING_KEYS.APPLY_EMAIL_TO] = payload.applyEmailTo.trim();
  }
  if (typeof payload.gmailUser === "string") {
    updates[SETTING_KEYS.GMAIL_USER] = payload.gmailUser.trim();
  }

  if (
    typeof payload.aiApiKey === "string" &&
    payload.aiApiKey.length > 0 &&
    !looksMasked(payload.aiApiKey)
  ) {
    updates[SETTING_KEYS.AI_API_KEY] = payload.aiApiKey;
  }

  if (
    typeof payload.telegramBotToken === "string" &&
    payload.telegramBotToken.length > 0 &&
    !looksMasked(payload.telegramBotToken)
  ) {
    updates[SETTING_KEYS.TELEGRAM_BOT_TOKEN] = payload.telegramBotToken;
  }

  if (
    typeof payload.zyteApiKey === "string" &&
    payload.zyteApiKey.length > 0 &&
    !looksMasked(payload.zyteApiKey)
  ) {
    updates[SETTING_KEYS.ZYTE_API_KEY] = payload.zyteApiKey;
  }

  if (
    typeof payload.gmailAppPassword === "string" &&
    payload.gmailAppPassword.length > 0 &&
    !looksMasked(payload.gmailAppPassword)
  ) {
    updates[SETTING_KEYS.GMAIL_APP_PASSWORD] = payload.gmailAppPassword;
  }

  if (Object.keys(updates).length > 0) {
    await upsertSettings(updates);
  }

  return getAppSettings({ redact: true });
}

/**
 * @param {string} value
 */
function looksMasked(value) {
  return /•/.test(value);
}
