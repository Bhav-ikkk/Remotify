import { AIService, createGeminiProvider } from "../services/ai/index.js";

/**
 * Sequentially evaluate jobs with AI, throttling between calls.
 * Never uses Promise.all for model calls — protects against 429s.
 *
 * On per-job failure: logs, sets aiScore=0, and continues.
 *
 * @param {Array<object>} jobs
 * @param {string} userProfile
 * @param {number} [delayMs=1500]
 * @param {{ aiService?: import('../services/ai/index.js').AIService }} [options]
 * @returns {Promise<Array<object>>}
 */
export async function processJobsWithAI(
  jobs,
  userProfile,
  delayMs = 1500,
  options = {}
) {
  const list = Array.isArray(jobs) ? jobs : [];
  const aiService =
    options.aiService || new AIService(createGeminiProvider());

  const scored = [];

  for (let index = 0; index < list.length; index += 1) {
    const job = list[index];

    try {
      const evaluation = await aiService.evaluateJob(job, userProfile);
      scored.push({
        ...job,
        aiScore: evaluation.score,
        aiMatchedSkills: evaluation.matchedSkills,
        aiMissingSkills: evaluation.missingSkills,
        aiReason: evaluation.reason,
        aiRawResponse: evaluation.raw ?? null,
      });
    } catch (error) {
      console.error(
        `[ai-batch] evaluateJob failed for "${job?.title || "unknown"}":`,
        error instanceof Error ? error.message : error
      );
      scored.push({
        ...job,
        aiScore: 0,
        aiMatchedSkills: [],
        aiMissingSkills: [],
        aiReason: "AI evaluation failed — score defaulted to 0.",
        aiRawResponse: null,
      });
    }

    // Throttle between requests (skip delay after the final item).
    if (index < list.length - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return scored;
}
