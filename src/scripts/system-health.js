/**
 * End-to-end system health check: scrape sample, profile, resume, apply CRM.
 */
import { prisma } from "../services/database.js";
import { buildAiMatchProfile, getActiveProfile } from "../services/profile.js";
import { generateMasterResumePdf } from "../services/resume/pdf.js";
import { loadMasterResumeJson } from "../services/resume/template.js";
import { detectAtsType, canAutoSubmit } from "../services/apply/ats.js";
import {
  getApplyStatusSummary,
  getApplyConfig,
  listApplications,
} from "../services/apply/queue.js";
import { ensureApplicationIdentity } from "../services/apply/identity.js";
import { AIService, createGeminiProvider } from "../services/ai/index.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const results = [];

function ok(name, detail) {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}: ${detail}`);
}
function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}: ${detail}`);
}

async function main() {
  // 1) Master resume locked
  try {
    const { path, data } = loadMasterResumeJson();
    ok(
      "locked_master_resume",
      `${path.includes("personal") ? "personal" : "demo"} · ${data.displayName || data.fullName}`
    );
  } catch (e) {
    fail("locked_master_resume", e.message);
  }

  // 2) Profile
  const profile = await getActiveProfile();
  if (profile) {
    ok(
      "candidate_profile",
      `${profile.fullName} · ${profile.skills.length} skills · ${profile.projects.length} projects · ${profile.priorities.length} priorities`
    );
  } else {
    fail("candidate_profile", "no active profile");
  }

  // 3) AI match brief
  const brief = await buildAiMatchProfile();
  ok("ai_match_brief", `${brief.length} chars`);

  // 4) Job store + score coverage
  const totalJobs = await prisma.job.count();
  const scored = await prisma.job.count({ where: { aiScore: { not: null } } });
  const high = await prisma.job.count({ where: { aiScore: { gte: 75 } } });
  const greenhouse = await prisma.job.count({
    where: { applyUrl: { contains: "greenhouse" } },
  });
  ok(
    "job_store",
    `total=${totalJobs} scored=${scored} score>=75=${high} greenhouse_urls=${greenhouse}`
  );

  // 5) Score one unscored greenhouse-ish job if API key present
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  const sample =
    (await prisma.job.findFirst({
      where: {
        aiScore: null,
        applyUrl: { contains: "greenhouse" },
      },
      orderBy: { scrapedAt: "desc" },
    })) ||
    (await prisma.job.findFirst({
      where: { aiScore: { not: null } },
      orderBy: { aiScore: "desc" },
    }));

  if (sample && apiKey) {
    try {
      const ai = new AIService(createGeminiProvider({ apiKey }));
      const evaluation = await ai.evaluateJob(sample, brief);
      await prisma.job.update({
        where: { id: sample.id },
        data: {
          aiScore: evaluation.score,
          aiMatchedSkills: evaluation.matchedSkills,
          aiMissingSkills: evaluation.missingSkills,
          aiReason: evaluation.reason,
        },
      });
      ok(
        "ai_scoring",
        `"${sample.title}" @ ${sample.company} → ${evaluation.score}% · matched=${evaluation.matchedSkills.slice(0, 4).join(", ")}`
      );
      sample.aiScore = evaluation.score;
    } catch (e) {
      fail("ai_scoring", e.message);
    }
  } else if (!apiKey) {
    fail("ai_scoring", "GEMINI_API_KEY missing");
  } else {
    fail("ai_scoring", "no sample job");
  }

  // 6) Resume PDF for a job
  const resumeJob =
    sample ||
    (await prisma.job.findFirst({ orderBy: { scrapedAt: "desc" } }));
  if (profile && resumeJob) {
    try {
      const { buffer, filename, resume } = await generateMasterResumePdf(
        profile,
        { job: resumeJob, useAi: Boolean(apiKey) }
      );
      const outDir = resolve(__dirname, "../../.tmp-verify");
      mkdirSync(outDir, { recursive: true });
      writeFileSync(resolve(outDir, filename), buffer);
      ok(
        "resume_pdf",
        `${filename} · ${buffer.length} bytes · skills=${(resume.skills || []).slice(0, 5).join(", ")}`
      );
    } catch (e) {
      fail("resume_pdf", e.message);
    }
  }

  // 7) Apply identity + queue
  const identity = await ensureApplicationIdentity();
  ok("apply_identity", `${identity.fullName} · ${identity.email}`);

  const config = await getApplyConfig();
  const summary = await getApplyStatusSummary();
  ok(
    "apply_queue",
    `enabled=${config.enabled} quota=${summary.used}/${summary.quota} queued=${summary.queued} review=${summary.needsReview} minScore=${config.minScore}`
  );

  const apps = await listApplications({ take: 5 });
  const atsBreakdown = {};
  for (const app of apps) {
    const t = detectAtsType(app.applyUrl);
    atsBreakdown[t] = (atsBreakdown[t] || 0) + 1;
  }
  ok(
    "apply_crm_rows",
    `showing ${apps.length} · ats sample=${JSON.stringify(atsBreakdown)} · autoSubmit greenhouse=${canAutoSubmit("greenhouse")}`
  );

  // 8) Telegram creds presence
  const tgToken = await prisma.setting.findUnique({
    where: { key: "telegram_bot_token" },
  });
  const tgChat = await prisma.setting.findUnique({
    where: { key: "telegram_chat_id" },
  });
  ok(
    "telegram_config",
    `token=${Boolean(tgToken?.value)} chat=${Boolean(tgChat?.value)}`
  );

  const failed = results.filter((r) => !r.ok);
  console.log("\n=== SUMMARY ===");
  console.log(
    JSON.stringify(
      {
        passed: results.filter((r) => r.ok).length,
        failed: failed.length,
        failures: failed,
      },
      null,
      2
    )
  );
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
