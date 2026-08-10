import { NextResponse } from "next/server";
import { handleTelegramUpdate } from "@/services/telegram/bot-commands";

/** Excel + PDF generation can exceed default serverless budgets. */
export const maxDuration = 60;

/**
 * Telegram Bot webhook — receives /grab, /matches, /resume, /help, /status.
 * Optional header: X-Telegram-Bot-Api-Secret-Token when TELEGRAM_WEBHOOK_SECRET is set.
 */
export async function POST(request) {
  try {
    const secret = String(process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
    if (secret) {
      const header = request.headers.get("x-telegram-bot-api-secret-token");
      if (header !== secret) {
        return NextResponse.json(
          { ok: false, message: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    const update = await request.json();
    const result = await handleTelegramUpdate(update);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error(
      "[telegram/webhook]",
      error instanceof Error ? error.message : error
    );
    // Always 200 to Telegram so it does not retry forever on handler bugs
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : "webhook error",
    });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Remotify Telegram webhook. POST updates from Bot API here.",
  });
}
