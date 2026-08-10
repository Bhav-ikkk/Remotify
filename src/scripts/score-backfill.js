/**
 * Score unscored DB jobs through quality prefilter + Gemini so apply queue can fill.
 *
 * Usage:
 *   node src/scripts/score-backfill.js
 *   node src/scripts/score-backfill.js --limit=40
 */
import { prisma } from "../services/database.js";
import { buildAiMatchProfile } from "../services/profile.js";
import { getSetting, SETTING_KEYS } from "../services/settings.js";
import { AIService, createGeminiProvider } from "../services/ai/index.js";
import { processJobsWithAI } from "../utils/ai-batch.js";
import {
  prefilterJobsForScoring,
  titlePassesQualityFilter,
} from "../utils/job-quality.js";
import { enqueueEligibleJobs } from "../services/apply/queue.js";

function parseLimit() {
  const arg = process.argv.find((a) => a.startsWith("--limit="));
  if (!arg) return 40;
  const n = Number(arg.split("=")[1]);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 200) : 40;
}

async function resolveApiKey() {
  const fromDb = await getSetting(SETTING_KEYS.AI_API_KEY);
  const dbKey = typeof fromDb === "string" ? fromDb.trim() : "";
  const envKey = String(
    process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ""
  ).trim();
  // Prefer Settings DB key for local scripts (env often holds stale placeholders).
  if (dbKey && !/test-gemini|changeme|your.?key|placeholder/i.test(dbKey)) {
    return dbKey;
  }
  return envKey || dbKey || "";
}

async function main() {
  const limit = parseLimit();
  const unscored = await prisma.job.findMany({
    where: { OR: [{ aiScore: null }, { aiScore: 0 }] },
    orderBy: { scrapedAt: "desc" },
    take: limit * 4,
  });

  const candidates = prefilterJobsForScoring(
    unscored.filter((j) => titlePassesQualityFilter(j.title))
  ).slice(0, limit);

  console.log(
    `unscoredFetched=${unscored.length} qualityCandidates=${candidates.length} limit=${limit}`
  );

  if (candidates.length === 0) {
    console.log("Nothing to score.");
    const enqueue = await enqueueEligibleJobs();
    console.log("enqueue:", enqueue);
    return;
  }

  const apiKey = await resolveApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY / ai_api_key missing");
  }

  const profile = await buildAiMatchProfile();
  const aiService = new AIService(createGeminiProvider({ apiKey }));
  const scored = await processJobsWithAI(candidates, profile, 800, { aiService });

  let updated = 0;
  for (const job of scored) {
    await prisma.job.update({
      where: { id: job.id },
      data: {
        aiScore: typeof job.aiScore === "number" ? job.aiScore : 0,
        aiMatchedSkills: Array.isArray(job.aiMatchedSkills)
          ? job.aiMatchedSkills
          : [],
        aiMissingSkills: Array.isArray(job.aiMissingSkills)
          ? job.aiMissingSkills
          : [],
        aiReason: job.aiReason || null,
        aiRawResponse: job.aiRawResponse ?? undefined,
      },
    });
    updated += 1;
  }

  const high = scored.filter((j) => (j.aiScore || 0) >= 75).length;
  console.log(`updated=${updated} score>=75=${high}`);

  const enqueue = await enqueueEligibleJobs();
  console.log("enqueue:", enqueue);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
