import { z } from "zod";
import {
  verifyTelegramConfig,
  resolveTelegramCredentials,
} from "@/services/notification";
import { SETTING_KEYS, upsertSettings } from "@/services/settings";

const payloadSchema = z.object({
  telegramBotToken: z.string().optional(),
  telegramChatId: z.string().optional(),
  persist: z.boolean().optional(),
});

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = payloadSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          message: "Invalid Telegram test payload.",
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const resolved = await resolveTelegramCredentials();
    const token = (
      parsed.data.telegramBotToken ||
      resolved.token ||
      ""
    ).trim();
    const chatId = (
      parsed.data.telegramChatId ||
      resolved.chatId ||
      ""
    ).trim();

    if (!token || !chatId) {
      return Response.json(
        {
          success: false,
          message:
            "Bot token and chat ID are required. Enter them in Settings or configure environment variables.",
        },
        { status: 400 }
      );
    }

    // Persist freshly entered credentials when requested (default true for UI tests).
    if (parsed.data.persist !== false) {
      const updates = {};
      if (parsed.data.telegramBotToken?.trim()) {
        updates[SETTING_KEYS.TELEGRAM_BOT_TOKEN] =
          parsed.data.telegramBotToken.trim();
      }
      if (parsed.data.telegramChatId?.trim()) {
        updates[SETTING_KEYS.TELEGRAM_CHAT_ID] =
          parsed.data.telegramChatId.trim();
      }
      if (Object.keys(updates).length > 0) {
        await upsertSettings(updates);
      }
    }

    const result = await verifyTelegramConfig(token, chatId);

    return Response.json({
      success: true,
      message: "Telegram connection verified. Test message delivered.",
      botUsername: result.bot?.username || null,
      messageId: result.messageId || null,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Telegram connection test failed.",
      },
      { status: 500 }
    );
  }
}
