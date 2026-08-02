/**
 * Provider contract for AI job evaluation.
 * Concrete providers (Gemini, OpenAI, local) must implement evaluateJob.
 *
 * @typedef {object} AiEvaluation
 * @property {number} score
 * @property {string[]} matchedSkills
 * @property {string[]} missingSkills
 * @property {string} reason
 */

/**
 * @typedef {object} AiProvider
 * @property {(job: object, userProfile: string) => Promise<{
 *   score: number,
 *   matchedSkills: string[],
 *   missingSkills: string[],
 *   reason: string,
 *   raw?: unknown
 * }>} evaluateJob
 */

/**
 * Strategy-pattern facade. Application code only talks to AIService.
 */
export class AIService {
  /**
   * @param {AiProvider} provider
   */
  constructor(provider) {
    if (!provider || typeof provider.evaluateJob !== "function") {
      throw new Error("AIService requires a provider implementing evaluateJob()");
    }
    this.provider = provider;
  }

  /**
   * Evaluate a normalized job against the candidate profile.
   * @param {object} job
   * @param {string} userProfile
   */
  async evaluateJob(job, userProfile) {
    return this.provider.evaluateJob(job, userProfile);
  }
}

/**
 * Factory helper for wiring the default Gemini strategy.
 * @param {AiProvider} provider
 */
export function createAIService(provider) {
  return new AIService(provider);
}

export { createGeminiProvider } from "./gemini.js";
