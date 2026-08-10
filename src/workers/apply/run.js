/**
 * Local Playwright apply worker ($0 hands).
 *
 * Usage:
 *   APPLY_API_BASE=http://localhost:3000 npm run apply:worker
 *   APPLY_DRY_RUN=1 npm run apply:worker
 *
 * Claims queued applications from the Remotify API, generates a tailored PDF,
 * fills Greenhouse/Lever/Ashby forms, reports outcomes, then emails a digest.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import axios from "axios";
import { generateMasterResumePdf } from "../../services/resume/pdf.js";
import { runAtsAdapter } from "./adapters/index.js";
import { sendApplyDigestEmail } from "../../services/apply/email.js";
import { getApplyStatusSummary } from "../../services/apply/queue.js";
import { prisma } from "../../services/database.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../../..");

function loadEnvFile() {
  const envPath = resolve(root, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function authHeaders() {
  const secret =
    process.env.APPLY_WORKER_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "";
  return secret ? { Authorization: `Bearer ${secret}` } : {};
}

async function main() {
  loadEnvFile();

  const base = (
    process.env.APPLY_API_BASE ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
  const dryRun =
    process.env.APPLY_DRY_RUN === "1" || process.argv.includes("--dry-run");
  const maxApps = Number(process.env.APPLY_WORKER_MAX || 35);
  const delayMs = Number(process.env.APPLY_DELAY_MS || 150000); // 2.5 min
  const headless = process.env.APPLY_HEADED !== "1";
  const workerId = `local-${process.pid}-${Date.now()}`;

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error(
      "Playwright is not installed. Run: npm install -D playwright && npx playwright install chromium"
    );
    process.exitCode = 1;
    return;
  }

  const outDir = resolve(root, ".tmp-applications");
  mkdirSync(outDir, { recursive: true });

  console.log(
    `[apply:worker] base=${base} dryRun=${dryRun} max=${maxApps} delayMs=${delayMs}`
  );

  const browser = await chromium.launch({ headless });
  let processed = 0;
  const outcomes = [];

  try {
    while (processed < maxApps) {
      const claimRes = await axios.post(
        `${base}/api/apply/claim`,
        { workerId },
        { headers: authHeaders(), timeout: 30000, validateStatus: () => true }
      );

      if (!claimRes.data?.success) {
        console.error("Claim API error:", claimRes.data);
        break;
      }
      if (!claimRes.data.claimed) {
        console.log(`Queue stop: ${claimRes.data.reason}`);
        break;
      }

      const { application, identity } = claimRes.data;
      const job = application.job;
      console.log(
        `\n[${processed + 1}] ${job.title} @ ${job.company} (${application.atsType}) score=${application.aiScore}`
      );

      let resumePath = "";
      let resumeFileName = "";
      try {
        const stubProfile = {
          slug: "bhavik-joshi",
          fullName: identity.fullName,
        };
        const { buffer, filename, resume } = await generateMasterResumePdf(
          stubProfile,
          { job, useAi: true }
        );
        resumeFileName = filename;
        resumePath = resolve(outDir, filename);
        writeFileSync(resumePath, buffer);
        console.log(`  resume: ${resumePath} (${buffer.length} bytes)`);
        console.log(`  headline: ${resume.headline}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("  resume failed:", message);
        await report(base, {
          applicationId: application.id,
          status: "failed",
          error: `resume:${message}`,
        });
        outcomes.push({ id: application.id, status: "failed" });
        processed += 1;
        continue;
      }

      const page = await browser.newPage();
      let result;
      try {
        result = await runAtsAdapter(page, {
          application,
          job,
          identity,
          resumePath,
          dryRun,
        });
      } catch (error) {
        result = {
          status: "failed",
          formPayload: {},
          confirmationText: null,
          error: error instanceof Error ? error.message : String(error),
        };
      } finally {
        await page.close().catch(() => {});
      }

      console.log(`  → ${result.status}${result.error ? ` (${result.error})` : ""}`);
      await report(base, {
        applicationId: application.id,
        status: result.status,
        formPayload: result.formPayload,
        error: result.error,
        confirmationText: result.confirmationText,
        resumeFileName,
        resumeMeta: { path: resumePath, dryRun },
      });
      outcomes.push({ id: application.id, status: result.status });
      processed += 1;

      if (processed < maxApps) {
        console.log(`  sleeping ${Math.round(delayMs / 1000)}s…`);
        await sleep(delayMs);
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  console.log(`\n[apply:worker] done processed=${processed}`, outcomes);

  try {
    const summary = await getApplyStatusSummary();
    const mail = await sendApplyDigestEmail({
      summary,
      note: `Local apply worker finished. processed=${processed} dryRun=${dryRun}`,
      attachExcel: true,
    });
    console.log("[apply:worker] digest email:", mail);
  } catch (error) {
    console.warn(
      "[apply:worker] digest email skipped:",
      error instanceof Error ? error.message : error
    );
  }

  await prisma.$disconnect().catch(() => {});
}

async function report(base, body) {
  const res = await axios.post(`${base}/api/apply/report`, body, {
    headers: authHeaders(),
    timeout: 30000,
    validateStatus: () => true,
  });
  if (!res.data?.success) {
    console.warn("Report failed:", res.data);
  }
  return res.data;
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
  await prisma.$disconnect().catch(() => {});
});
