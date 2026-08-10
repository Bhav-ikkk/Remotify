import { prisma } from "./database.js";
import {
  resolveTelegramCredentials,
  telegramApi,
  sendTelegramDocument,
} from "./telegram/client.js";
import { getActiveProfile } from "./profile.js";
import { generateMasterResumePdf } from "./resume/pdf.js";

export { resolveTelegramCredentials } from "./telegram/client.js";

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
    text: "👋 Remotify Connection Test: Your notification pipeline is configured successfully!\n\nTry /help for grab · matches · resume commands.",
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
 * Send top matching jobs to Telegram — message + tailored resume PDF when profile exists.
 * @param {Array<object>} jobs
 * @returns {Promise<{ sent: number, failed: number, errors: string[], deliveredIds: string[], resumesSent: number }>}
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
  let resumesSent = 0;
  const errors = [];
  const deliveredIds = [];

  let profile = null;
  try {
    profile = await getActiveProfile();
  } catch (error) {
    console.error(
      "[telegram] profile load failed:",
      error instanceof Error ? error.message : error
    );
  }

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

      if (profile) {
        try {
          const { buffer, filename } = await generateMasterResumePdf(profile, {
            job,
          });
          await sendTelegramDocument(token, chatId, buffer, filename, {
            caption: `Resume tailored for ${job.title || "role"} @ ${job.company || "company"}`,
          });
          resumesSent += 1;
        } catch (resumeError) {
          const message =
            resumeError instanceof Error
              ? resumeError.message
              : String(resumeError);
          errors.push(`resume:${message}`);
          console.error("[telegram] resume PDF failed:", message);
        }
      }
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

  return { sent, failed, errors, deliveredIds, resumesSent };
}

/**
 * Send a short pipeline run summary to Telegram (always, after cron/manual runs).
 * @param {{
 *   status?: string,
 *   jobsParsed?: number,
 *   jobsProcessed?: number,
 *   jobsMatched?: number,
 *   notificationsSent?: number,
 *   durationMs?: number,
 *   manualOverride?: boolean,
 * }} summary
 * @returns {Promise<{ sent: boolean, error?: string }>}
 */
export async function sendRunReport(summary) {
  const { token, chatId } = await resolveTelegramCredentials();
  if (!token || !chatId) {
    return { sent: false, error: "Telegram not configured" };
  }

  const status = escapeHtml(summary?.status || "unknown");
  const parsed = Number(summary?.jobsParsed) || 0;
  const processed = Number(summary?.jobsProcessed) || 0;
  const matched = Number(summary?.jobsMatched) || 0;
  const notified = Number(summary?.notificationsSent) || 0;
  const seconds =
    typeof summary?.durationMs === "number"
      ? Math.round(summary.durationMs / 1000)
      : null;
  const trigger = summary?.manualOverride ? "Manual" : "Scheduled";

  const text = [
    `📊 <b>Remotify ${escapeHtml(trigger)} Report</b>`,
    `Status: <b>${status}</b>`,
    `Parsed: ${parsed} · Processed: ${processed} · Matched: ${matched}`,
    `Telegram leads sent: ${notified}`,
    seconds != null ? `Duration: ${seconds}s` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await telegramApi(token, "sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    if (!response?.ok) {
      const error = response?.description || "sendMessage failed";
      await logNotificationFailure({
        action: "sendRunReport",
        chatId,
        error,
      });
      return { sent: false, error };
    }
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[telegram] sendRunReport failed:", message);
    return { sent: false, error: message };
  }
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

  lines.push(
    "",
    "<i>More leads: /grab (all) · /matches (scored) · /resume (PDF)</i>"
  );

  return lines.join("\n");
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
