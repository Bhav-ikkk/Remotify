/**
 * Windows helper: wait for morning cron, ensure Next is up, run apply worker.
 * Schedule via Task Scheduler after ~08:30 IST (post UTC 2 cron) or evening.
 *
 * Usage:
 *   node src/scripts/apply-worker-schedule.js
 *   node src/scripts/apply-worker-schedule.js --dry-run
 *   APPLY_SCHEDULE_WAIT_MS=0 node src/scripts/apply-worker-schedule.js
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../..");

const waitMs = Number(process.env.APPLY_SCHEDULE_WAIT_MS || 0);
const dryRun =
  process.argv.includes("--dry-run") || process.env.APPLY_DRY_RUN === "1";
const apiBase =
  process.env.APPLY_API_BASE ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

async function sleep(ms) {
  if (ms <= 0) return;
  console.log(`Waiting ${ms}ms before worker…`);
  await new Promise((r) => setTimeout(r, ms));
}

async function pingApi() {
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/applications`);
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  await sleep(waitMs);

  const up = await pingApi();
  if (!up) {
    console.error(
      `API not reachable at ${apiBase}. Start Next first: npm run dev`
    );
    process.exitCode = 1;
    return;
  }

  const args = ["src/workers/apply/run.js"];
  if (dryRun) args.push("--dry-run");

  console.log(`Starting worker (${dryRun ? "dry-run" : "live"})…`);
  const child = spawn(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      APPLY_API_BASE: apiBase,
      APPLY_DRY_RUN: dryRun ? "1" : process.env.APPLY_DRY_RUN || "",
    },
  });

  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
