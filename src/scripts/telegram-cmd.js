import { prisma } from "../services/database.js";
import { resolveTelegramCredentials } from "../services/telegram/client.js";
import { handleTelegramUpdate } from "../services/telegram/bot-commands.js";

const { chatId } = await resolveTelegramCredentials();
if (!chatId) throw new Error("No telegram chat id");

const command = process.argv[2] || "/status";
const result = await handleTelegramUpdate({
  message: {
    text: command,
    chat: { id: chatId },
  },
});
console.log(result);
await prisma.$disconnect();
