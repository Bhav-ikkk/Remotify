/**
 * Ensure Neon scheduler is enabled for dual daily Vercel Hobby crons (UTC 2 & 12).
 */
import { readFileSync } from "fs";
import { prisma } from "../services/database.js";
import {
  DEFAULT_TARGET_HOURS_UTC,
  encodeTargetHours,
  computeNextRunAtFromHours,
  serializeScheduler,
} from "../services/scheduler.js";

function loadEnvFile() {
  try {
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
  } catch {
    // rely on process env
  }
}

async function main() {
  loadEnvFile();
  const hours = DEFAULT_TARGET_HOURS_UTC;
  const config = await prisma.schedulerConfig.upsert({
    where: { name: "default" },
    create: {
      name: "default",
      isEnabled: true,
      isRunning: false,
      targetHourUtc: hours[0],
      cronExpression: encodeTargetHours(hours),
      nextRunAt: computeNextRunAtFromHours(hours),
      lastRunStatus: "armed",
    },
    update: {
      isEnabled: true,
      isRunning: false,
      targetHourUtc: hours[0],
      cronExpression: encodeTargetHours(hours),
      nextRunAt: computeNextRunAtFromHours(hours),
      lastRunStatus: "armed",
    },
  });

  console.log(JSON.stringify(serializeScheduler(config), null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
