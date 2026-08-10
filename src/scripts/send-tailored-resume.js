/**
 * Generate a tailored resume for a real job from the DB and send it to Telegram.
 *
 * Usage:
 *   node src/scripts/send-tailored-resume.js
 *   node src/scripts/send-tailored-resume.js --job-id <cuid>
 *   node src/scripts/send-tailored-resume.js --min-score 70
 */
import { prisma } from "../services/database.js";
import { getActiveProfile } from "../services/profile.js";
import { generateMasterResumePdf } from "../services/resume/pdf.js";
import {
  resolveTelegramCredentials,
  sendTelegramDocument,
  telegramApi,
} from "../services/telegram/client.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i < 0) return null;
  return process.argv[i + 1] || null;
}

async function main() {
  const profile = await getActiveProfile();
  if (!profile) throw new Error("No active profile. Run npm run profile:seed");

  const jobId = argValue("--job-id");
  const minScore = Number(argValue("--min-score") || 50);

  let job = null;
  if (jobId) {
    job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error(`Job not found: ${jobId}`);
  } else {
    job = await prisma.job.findFirst({
      where: {
        aiScore: { gte: Number.isFinite(minScore) ? minScore : 50 },
        applyUrl: { not: "" },
      },
      orderBy: [{ aiScore: "desc" }, { scrapedAt: "desc" }],
    });
  }

  if (!job) {
    // Fall back to any recent scraped job so we still demo the resume
    job = await prisma.job.findFirst({
      orderBy: { scrapedAt: "desc" },
    });
  }
  if (!job) throw new Error("No jobs in database — run scrape:persist first");

  console.log(
    `Tailoring for: ${job.title} @ ${job.company} (score=${job.aiScore ?? "n/a"})`
  );

  const { buffer, filename, resume } = await generateMasterResumePdf(profile, {
    job,
    useAi: true,
  });

  const outDir = resolve(__dirname, "../../.tmp-verify");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, filename);
  writeFileSync(outPath, buffer);
  console.log(`Wrote ${outPath} (${buffer.length} bytes)`);
  console.log(`Headline: ${resume.headline}`);
  console.log(`Summary: ${resume.summary.slice(0, 160)}…`);
  console.log(`Top skills: ${(resume.skills || []).slice(0, 8).join(", ")}`);

  const { token, chatId } = await resolveTelegramCredentials();
  if (!token || !chatId) throw new Error("Telegram not configured");

  await telegramApi(token, "sendMessage", {
    chat_id: chatId,
    text: [
      "<b>Tailored resume ready</b>",
      `Role: <b>${escapeHtml(job.title)}</b>`,
      `Company: ${escapeHtml(job.company)}`,
      typeof job.aiScore === "number"
        ? `Match score: ${Math.round(job.aiScore)}%`
        : null,
      job.applyUrl
        ? `<a href="${escapeHtml(job.applyUrl)}">Job link</a>`
        : null,
    ]
      .filter(Boolean)
      .join("\n"),
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });

  await sendTelegramDocument(token, chatId, buffer, filename, {
    caption: `${profile.fullName} — tailored for ${job.title} @ ${job.company}`,
  });

  console.log("Sent to Telegram");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
