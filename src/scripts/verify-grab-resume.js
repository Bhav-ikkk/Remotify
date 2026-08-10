/**
 * Local verification: Excel export + master resume PDF + optional Telegram send.
 * Usage:
 *   node src/scripts/verify-grab-resume.js
 *   node src/scripts/verify-grab-resume.js --send
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../services/database.js";
import {
  queryGrabJobs,
  buildJobsExcelBuffer,
  grabFilename,
} from "../services/export/jobs-excel.js";
import { getActiveProfile } from "../services/profile.js";
import { generateMasterResumePdf } from "../services/resume/pdf.js";
import {
  resolveTelegramCredentials,
  sendTelegramDocument,
  telegramApi,
} from "../services/telegram/client.js";
import { registerBotCommands } from "../services/telegram/bot-commands.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "../../.tmp-verify");
const shouldSend = process.argv.includes("--send");

async function main() {
  mkdirSync(outDir, { recursive: true });

  console.log("1) Profile…");
  const profile = await getActiveProfile();
  if (!profile) throw new Error("No active profile — run npm run profile:seed");
  console.log(`   ${profile.fullName} · ${profile.skills.length} skills · ${profile.projects.length} projects`);

  console.log("2) Grab all leads…");
  const all = await queryGrabJobs({ mode: "all", days: 30 });
  console.log(`   ${all.jobs.length} apply-open jobs`);

  console.log("3) Grab matches…");
  const matches = await queryGrabJobs({ mode: "matches", days: 30 });
  console.log(`   ${matches.jobs.length} matched jobs`);

  console.log("4) Excel buffers…");
  const allXlsx = await buildJobsExcelBuffer(all.jobs, { mode: "all" });
  const matchXlsx = await buildJobsExcelBuffer(matches.jobs, { mode: "matches" });
  const allPath = resolve(outDir, grabFilename("all"));
  const matchPath = resolve(outDir, grabFilename("matches"));
  writeFileSync(allPath, allXlsx);
  writeFileSync(matchPath, matchXlsx);
  console.log(`   wrote ${allPath} (${allXlsx.length} bytes)`);
  console.log(`   wrote ${matchPath} (${matchXlsx.length} bytes)`);

  console.log("5) Master resume PDF…");
  const sampleJob = matches.jobs[0] || all.jobs[0] || null;
  const { buffer: pdf, filename: pdfName } = await generateMasterResumePdf(
    profile,
    sampleJob ? { job: sampleJob } : {}
  );
  const pdfPath = resolve(outDir, pdfName);
  writeFileSync(pdfPath, pdf);
  console.log(`   wrote ${pdfPath} (${pdf.length} bytes)`);

  console.log("6) Register bot commands…");
  const cmds = await registerBotCommands();
  console.log(`   ${cmds.commands.map((c) => "/" + c.command).join(" ")}`);

  if (shouldSend) {
    console.log("7) Send Excel + resume to Telegram…");
    const { token, chatId } = await resolveTelegramCredentials();
    if (!token || !chatId) throw new Error("Telegram credentials missing");

    await telegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: "<b>Remotify verify</b>\nSending /grab sample Excel + master resume PDF…",
      parse_mode: "HTML",
    });

    await sendTelegramDocument(token, chatId, allXlsx, grabFilename("all"), {
      caption: `📋 Verify /grab — ${all.jobs.length} leads`,
    });
    await sendTelegramDocument(token, chatId, pdf, pdfName, {
      caption: `📄 Verify /resume — ${profile.fullName}`,
    });
    console.log("   sent to Telegram");
  } else {
    console.log("7) Skip Telegram send (pass --send to deliver)");
  }

  console.log("\nOK — grab + resume verification passed");
}

main()
  .catch((error) => {
    console.error("VERIFY FAILED:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
