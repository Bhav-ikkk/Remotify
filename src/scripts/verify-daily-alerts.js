/**
 * Arm Neon scheduler + verify Telegram delivery for daily alerts.
 */
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import axios from "axios";

function loadEnvFile() {
  const text = readFileSync(".env", "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function shouldRun(config, now) {
  if (!config?.isEnabled) return false;
  if (config.isRunning) return false;
  const hours = String(config.cronExpression || "")
    .split(",")
    .map((p) => Number(p.trim()))
    .filter((h) => Number.isInteger(h) && h >= 0 && h <= 23);
  if (!hours.includes(now.getUTCHours())) return false;
  return true;
}

async function main() {
  loadEnvFile();
  const prisma = new PrismaClient();

  try {
    const hours = [2, 12];
    const now = new Date();
    const next = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        hours[0],
        0,
        0,
        0
      )
    );
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);

    const config = await prisma.schedulerConfig.upsert({
      where: { name: "default" },
      create: {
        name: "default",
        isEnabled: true,
        isRunning: false,
        targetHourUtc: hours[0],
        cronExpression: hours.join(","),
        nextRunAt: next,
        lastRunStatus: "armed",
      },
      update: {
        isEnabled: true,
        isRunning: false,
        targetHourUtc: hours[0],
        cronExpression: hours.join(","),
        nextRunAt: next,
        lastRunStatus: "armed",
      },
    });

    console.log(
      JSON.stringify({
        isEnabled: config.isEnabled,
        cronExpression: config.cronExpression,
        targetHourUtc: config.targetHourUtc,
        nextRunAt: config.nextRunAt,
      })
    );

    const morning = shouldRun(config, new Date(Date.UTC(2030, 0, 1, 2, 15)));
    const evening = shouldRun(config, new Date(Date.UTC(2030, 0, 1, 12, 15)));
    const offHour = shouldRun(config, new Date(Date.UTC(2030, 0, 1, 9, 15)));
    console.log({ morning, evening, offHour });
    if (!morning || !evening || offHour) {
      throw new Error("Hour gating failed");
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) throw new Error("Telegram env missing");

    // Prefer DB telegram settings if present.
    const rows = await prisma.setting.findMany({
      where: { key: { in: ["telegram_bot_token", "telegram_chat_id"] } },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const botToken =
      (typeof map.telegram_bot_token === "string" && map.telegram_bot_token) ||
      token;
    const targetChat =
      (typeof map.telegram_chat_id === "string" && map.telegram_chat_id) ||
      chatId;

    const text = [
      "📊 <b>Remotify Manual Report</b>",
      "Status: <b>armed</b>",
      "Scheduler enabled for morning (02:00 UTC) and evening (12:00 UTC).",
      "You will get a run summary after each automatic cron completes.",
    ].join("\n");

    const { data } = await axios.post(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        chat_id: targetChat,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      },
      { timeout: 20000, validateStatus: () => true }
    );

    if (!data?.ok) {
      throw new Error(data?.description || "Telegram send failed");
    }

    console.log("OK — scheduler armed and Telegram delivery verified.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
