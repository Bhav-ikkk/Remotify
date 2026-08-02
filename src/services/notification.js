import axios from "axios";
import { prisma } from "@/services/database";
import { getSetting, SETTING_KEYS } from "@/services/settings";

/**
 * Resolve Telegram credentials: DB settings first, then env fallback.
 * @returns {Promise<{ token: string, chatId: string }>}
 */
export async function resolveTelegramCredentials() {
  const dbToken = await getSetting(SETTING_KEYS.TELEGRAM_BOT_TOKEN);
  const dbChatId = await getSetting(SETTING_KEYS.TELEGRAM_CHAT_ID);

  const envToken = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const envChatId = String(process.env.TELEGRAM_CHAT_ID || "").trim();

  const dbTokenValue =
    typeof dbToken === "string" && dbToken.trim() ? dbToken.trim() : "";
  const dbChatValue =
    typeof dbChatId === "string" && dbChatId.trim() ? dbChatId.trim() : "";

  // Prefer runtime env so local .env wins over stale DB placeholders.
  const token = envToken || dbTokenValue;
  const chatId = envChatId || dbChatValue;

  return { token, chatId };
}

/**
 * Verify Telegram bot token (+ optional chat) via getMe and a probe message.
 * @param {string} [token]
 * @param {string} [chatId]
 * @returns {Promise<{ success: true, bot?: object, messageId?: number }>}
 */
export async function verifyTelegramConfig(token, chatId) {
  const resolved = await resolveTelegramCredentials();
  const botToken = String(token || resolved.token || "").trim();
  const targetChatId = String(chatId || resolved.chatId || "").trim();

  if (!botToken) {
    throw new Error("Telegram bot token is missing.");
  }
  if (!targetChatId) {
    throw new Error("Telegram chat ID is missing.");
  }

  const me = await telegramApi(botToken, "getMe");
  if (!me?.ok) {
    throw new Error(me?.description || "Telegram getMe failed.");
  }

  const probe = await telegramApi(botToken, "sendMessage", {
    chat_id: targetChatId,
    text: "👋 Remotify Connection Test: Your notification pipeline is configured successfully!",
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });

  if (!probe?.ok) {
    await logNotificationFailure({
      action: "verifyTelegramConfig",
      chatId: targetChatId,
      error: probe?.description || "sendMessage failed",
    });
    throw new Error(
      probe?.description ||
        "Telegram rejected the test message. Check chat ID and that you've started the bot."
    );
  }

  return {
    success: true,
    bot: me.result,
    messageId: probe.result?.message_id,
  };
}

/**
 * Send top matching jobs to the configured Telegram chat.
 * @param {Array<object>} jobs
 * @returns {Promise<{ sent: number, failed: number, errors: string[], deliveredIds: string[] }>}
 */
export async function sendTopMatches(jobs) {
  const { token, chatId } = await resolveTelegramCredentials();
  if (!token || !chatId) {
    throw new Error(
      "Telegram is not configured. Set bot token and chat ID in Settings or environment."
    );
  }

  const list = Array.isArray(jobs) ? jobs.slice(0, 5) : [];
  let sent = 0;
  let failed = 0;
  const errors = [];
  const deliveredIds = [];

  for (const job of list) {
    try {
      const text = formatJobMessage(job);
      const response = await telegramApi(token, "sendMessage", {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      });

      if (!response?.ok) {
        failed += 1;
        const message = response?.description || "sendMessage failed";
        errors.push(message);
        await logNotificationFailure({
          action: "sendTopMatches",
          chatId,
          jobTitle: job?.title,
          error: message,
        });
        continue;
      }

      sent += 1;
      if (job?.id) deliveredIds.push(job.id);
      await logNotificationSuccess({
        action: "sendTopMatches",
        chatId,
        jobTitle: job?.title,
        messageId: response.result?.message_id,
      });
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
      console.error("[telegram] sendTopMatches failed:", message);
      await logNotificationFailure({
        action: "sendTopMatches",
        chatId,
        jobTitle: job?.title,
        error: message,
      });
    }
  }

  return { sent, failed, errors, deliveredIds };
}

/**
 * Format a scored job as Telegram HTML.
 * @param {object} job
 * @returns {string}
 */
export function formatJobMessage(job) {
  const company = escapeHtml(job?.company || "Unknown Company");
  const title = escapeHtml(job?.title || "Untitled Role");
  const score =
    typeof job?.aiScore === "number" && Number.isFinite(job.aiScore)
      ? Math.round(job.aiScore)
      : "N/A";
  const location = escapeHtml(job?.location || "Not Specified");
  const salary = formatSalary(job);
  const missing = formatMissingSkills(job?.aiMissingSkills);
  const reason = escapeHtml(
    job?.aiReason || "No AI reasoning was provided for this match."
  );
  const applyUrl = String(job?.applyUrl || "").trim();

  const lines = [
    `🏢 <b>${company}</b> - 🚀 <b>${title}</b>`,
    `🎯 <b>Match Score:</b> ${score}%`,
    `📍 <b>Location:</b> ${location}`,
    `💰 <b>Salary:</b> ${escapeHtml(salary)}`,
    `❌ <b>Missing Skills:</b> ${escapeHtml(missing)}`,
    "",
    `📝 <i>${reason}</i>`,
  ];

  if (applyUrl) {
    lines.push("", `🔗 <a href="${escapeHtml(applyUrl)}">Apply Directly Here</a>`);
  }

  return lines.join("\n");
}

/**
 * @param {string} token
 * @param {string} method
 * @param {object} [payload]
 */
async function telegramApi(token, method, payload) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  try {
    const { data } = await axios.post(url, payload ?? {}, {
      timeout: 20000,
      validateStatus: () => true,
    });
    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[telegram] ${method} network error:`, message);
    return { ok: false, description: message };
  }
}

/**
 * @param {object} job
 */
function formatSalary(job) {
  if (job?.salary) {
    return job.currency ? `${job.salary} ${job.currency}` : String(job.salary);
  }
  return "Not Specified";
}

/**
 * @param {unknown} skills
 */
function formatMissingSkills(skills) {
  if (!Array.isArray(skills) || skills.length === 0) return "None";
  return skills.map(String).filter(Boolean).join(", ") || "None";
}

/**
 * @param {string} value
 */
function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Persist a failure into the latest running RunHistory notificationLog when present,
 * otherwise write a lightweight RunHistory telemetry row.
 * @param {object} entry
 */
async function logNotificationFailure(entry) {
  await appendNotificationLog({
    ...entry,
    status: "failed",
    at: new Date().toISOString(),
  });
}

/**
 * @param {object} entry
 */
async function logNotificationSuccess(entry) {
  await appendNotificationLog({
    ...entry,
    status: "sent",
    at: new Date().toISOString(),
  });
}

/**
 * @param {object} entry
 */
async function appendNotificationLog(entry) {
  try {
    const latest = await prisma.runHistory.findFirst({
      where: { status: "running" },
      orderBy: { startedAt: "desc" },
    });

    if (latest) {
      const current = Array.isArray(latest.notificationLog)
        ? latest.notificationLog
        : [];
      await prisma.runHistory.update({
        where: { id: latest.id },
        data: {
          notificationLog: [...current, entry],
          errorCount:
            entry.status === "failed" ? latest.errorCount + 1 : latest.errorCount,
        },
      });
      return;
    }

    await prisma.runHistory.create({
      data: {
        status: entry.status === "failed" ? "partial" : "success",
        finishedAt: new Date(),
        durationMs: 0,
        notificationsSent: entry.status === "sent" ? 1 : 0,
        errorCount: entry.status === "failed" ? 1 : 0,
        notificationLog: [entry],
        errors: entry.status === "failed" ? [entry] : [],
      },
    });
  } catch (error) {
    console.error(
      "[telegram] failed to persist notification log:",
      error instanceof Error ? error.message : error
    );
  }
}
