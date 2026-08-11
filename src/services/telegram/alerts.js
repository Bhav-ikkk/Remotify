import { resolveTelegramCredentials, telegramApi } from "./client.js";

/**
 * Loud operational alert: always logs to console, and mirrors to Telegram
 * when configured. Use for failure modes that must never pass silently
 * (missing master resume, unconfigured email recipient, failed submits).
 *
 * Never throws — alerting must not mask the original failure.
 *
 * @param {string} text Plain text (HTML-escaped before sending)
 * @returns {Promise<{ sent: boolean, error?: string }>}
 */
export async function sendOpsAlert(text) {
  const message = String(text || "").trim();
  console.error(`[remotify:alert] ${message}`);

  try {
    const { token, chatId } = await resolveTelegramCredentials();
    if (!token || !chatId) {
      return { sent: false, error: "telegram_not_configured" };
    }

    const response = await telegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: `🚨 <b>Remotify alert</b>\n${escapeHtml(message)}`,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });

    if (!response?.ok) {
      return { sent: false, error: response?.description || "sendMessage failed" };
    }
    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * @param {string} value
 */
function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
