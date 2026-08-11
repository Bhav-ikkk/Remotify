/**
 * Generate resume from the locked master resume (DB CandidateProfile, or the
 * demo file with RESUME_DEMO=1) and send to Telegram.
 * Optional: pass --offline to skip job lookup entirely (master PDF only).
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateMasterResumePdf } from "../services/resume/pdf.js";
import { loadMasterResume } from "../services/resume/template.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const offline = process.argv.includes("--offline");
const masterOnly = process.argv.includes("--master");

function loadEnvFile() {
  const envPath = resolve(__dirname, "../../.env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^"|"$/g, "").trim();
    }
  }
}

function slugify(value) {
  return String(value || "resume")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function tryLoadJob() {
  if (offline) return null;
  try {
    const { prisma } = await import("../services/database.js");
    const job = await prisma.job.findFirst({
      where: { aiScore: { gte: 50 }, applyUrl: { not: "" } },
      orderBy: [{ aiScore: "desc" }, { scrapedAt: "desc" }],
    });
    await prisma.$disconnect().catch(() => {});
    return job;
  } catch (error) {
    console.warn(
      "DB unavailable, generating master/offline tailor:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

async function sendTelegram(buffer, filename, caption, preamble) {
  const { default: axios } = await import("axios");
  const FormData = (await import("form-data")).default;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error("TELEGRAM_BOT_TOKEN / CHAT_ID missing in .env");

  if (preamble) {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: preamble,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  }

  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption);
  form.append("document", buffer, {
    filename,
    contentType: "application/pdf",
  });
  const { data } = await axios.post(
    `https://api.telegram.org/bot${token}/sendDocument`,
    form,
    { headers: form.getHeaders(), maxContentLength: Infinity, maxBodyLength: Infinity }
  );
  if (!data?.ok) throw new Error(data?.description || "sendDocument failed");
}

async function main() {
  loadEnvFile();
  const { source, data } = await loadMasterResume();
  console.log(`Master resume source: ${source}`);

  const stubProfile = {
    slug: slugify(data.displayName || data.fullName),
    fullName: data.displayName || data.fullName,
  };

  let job = masterOnly ? null : await tryLoadJob();
  if (!masterOnly && !job) {
    // Demo tailor target when DB is down — fullstack/Next role
    job = {
      title: "Full Stack Engineer (Next.js / PostgreSQL)",
      company: "Remote Startup",
      location: "Remote",
      skills: ["Next.js", "React", "PostgreSQL", "Node.js", "TypeScript"],
      description:
        "Build product features with Next.js, React, Node.js and PostgreSQL. Own UI through database. Bonus: GenAI features, Prisma, NestJS.",
      applyUrl: "https://example.com/jobs/fullstack",
      aiScore: null,
    };
    console.log("Using offline sample job for tailoring");
  } else if (job) {
    console.log(`Using DB job: ${job.title} @ ${job.company}`);
  } else {
    console.log("Generating exact master resume (no job tailor)");
  }

  const { buffer, filename, resume } = await generateMasterResumePdf(stubProfile, {
    job,
    useAi: Boolean(job),
  });

  const outDir = resolve(__dirname, "../../.tmp-verify");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, filename);
  writeFileSync(outPath, buffer);
  console.log(`Wrote ${outPath} (${buffer.length} bytes)`);
  console.log(`Summary: ${resume.summary.slice(0, 140)}…`);

  await sendTelegram(
    buffer,
    filename,
    job
      ? `${resume.fullName} — ATS resume locked to your PDF · tailored for ${job.title}`
      : `${resume.fullName} — exact master ATS resume (locked to your PDF)`,
    job
      ? [
          "<b>Resume locked to your ATS PDF</b>",
          `Source: Bhavik_Joshi_Resume`,
          `Tailored for: <b>${job.title}</b> @ ${job.company}`,
          "Layout: Summary · Skills · Experience · Projects · Education · Achievements",
        ].join("\n")
      : [
          "<b>Exact master resume</b> (locked to your PDF wording)",
          "No job tailor — compare this to Bhavik_Joshi_Resume.pdf",
          "Layout: Summary · Skills · Experience · Projects · Education · Achievements",
        ].join("\n")
  );
  console.log("Sent to Telegram");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
