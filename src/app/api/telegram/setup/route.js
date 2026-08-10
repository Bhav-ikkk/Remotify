import { NextResponse } from "next/server";
import {
  registerBotCommands,
  setTelegramWebhook,
  BOT_COMMANDS,
} from "@/services/telegram/bot-commands";

/**
 * POST /api/telegram/setup
 * Registers slash commands and optionally sets webhook URL.
 *
 * Body: { webhookUrl?: string }
 * Auth: Authorization: Bearer <CRON_SECRET> or ?secret=
 */
export async function POST(request) {
  try {
    if (!authorize(request)) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const appUrl = String(
      body.webhookUrl ||
        process.env.NEXT_PUBLIC_APP_URL ||
        ""
    )
      .trim()
      .replace(/\/$/, "");

    const commands = await registerBotCommands();

    let webhook = null;
    if (appUrl) {
      const url = appUrl.includes("/api/telegram/webhook")
        ? appUrl
        : `${appUrl}/api/telegram/webhook`;
      webhook = await setTelegramWebhook(
        url,
        process.env.TELEGRAM_WEBHOOK_SECRET || undefined
      );
    }

    return NextResponse.json({
      success: true,
      commands: BOT_COMMANDS,
      commandsResult: commands,
      webhook,
      hint: appUrl
        ? "Webhook set. Open Telegram and try /help"
        : "Commands registered. Pass webhookUrl or set NEXT_PUBLIC_APP_URL to enable webhook.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Setup failed",
      },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  if (!authorize(request)) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }
  return NextResponse.json({
    success: true,
    commands: BOT_COMMANDS,
    webhookPath: "/api/telegram/webhook",
  });
}

/**
 * @param {Request} request
 */
function authorize(request) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  if (!secret) return true; // local/dev convenience
  const header = request.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("secret") || "";
  return bearer === secret || query === secret;
}
