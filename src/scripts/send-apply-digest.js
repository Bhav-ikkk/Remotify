/**
 * Send Telegram apply digest (submitted / needs_review / low-score skips).
 * Usage: node src/scripts/send-apply-digest.js
 */
import { prisma } from "../services/database.js";
import {
  resolveTelegramCredentials,
  telegramApi,
} from "../services/telegram/client.js";
import { buildApplyDigestText } from "../services/apply/queue.js";

async function main() {
  const { token, chatId } = await resolveTelegramCredentials();
  if (!token || !chatId) {
    throw new Error("Telegram token/chatId not configured");
  }
  const text = await buildApplyDigestText();
  const res = await telegramApi(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
  if (!res?.ok) {
    throw new Error(res?.description || "sendMessage failed");
  }
  console.log("Digest sent.");
  console.log(text.replace(/<[^>]+>/g, ""));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
