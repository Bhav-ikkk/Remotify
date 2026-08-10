import axios from "axios";
import FormData from "form-data";
import { getSetting, SETTING_KEYS } from "../settings.js";

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

  return {
    token: dbTokenValue || envToken,
    chatId: dbChatValue || envChatId,
  };
}

/**
 * @param {string} token
 * @param {string} method
 * @param {object} [payload]
 */
export async function telegramApi(token, method, payload) {
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
 * Send a file (Excel / PDF) via Telegram sendDocument.
 * @param {string} token
 * @param {string} chatId
 * @param {Buffer} buffer
 * @param {string} filename
 * @param {{ caption?: string }} [options]
 */
export async function sendTelegramDocument(
  token,
  chatId,
  buffer,
  filename,
  options = {}
) {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("document", buffer, {
    filename,
    contentType: filename.endsWith(".pdf")
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  if (options.caption) form.append("caption", options.caption);

  const url = `https://api.telegram.org/bot${token}/sendDocument`;
  const { data } = await axios.post(url, form, {
    headers: form.getHeaders(),
    timeout: 60000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    validateStatus: () => true,
  });

  if (!data?.ok) {
    throw new Error(data?.description || "sendDocument failed");
  }
  return data;
}
