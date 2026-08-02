import { GoogleGenAI, Type } from "@google/genai";

const MODEL = "gemini-2.5-flash";

const SYSTEM_INSTRUCTION = `You are a strict, objective technical recruiter.
Score how well a candidate profile matches a job posting.
Be conservative: only mark skills as matched when clearly evidenced in the profile.
Return ONLY JSON matching the required schema. Do not invent employer requirements that are not in the job text.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    score: {
      type: Type.NUMBER,
      description: "Match score from 0 to 100",
    },
    matchedSkills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Skills present in both the profile and the job",
    },
    missingSkills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Important job skills missing from the profile",
    },
    reason: {
      type: Type.STRING,
      description: "One or two sentences explaining the score",
    },
  },
  required: ["score", "matchedSkills", "missingSkills", "reason"],
};

/**
 * Gemini-backed AI provider implementing the evaluateJob strategy contract.
 */
export class GeminiProvider {
  /**
   * @param {{ apiKey?: string, model?: string }} [options]
   */
  constructor(options = {}) {
    const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is required to initialize GeminiProvider"
      );
    }

    this.model = options.model || MODEL;
    this.client = new GoogleGenAI({ apiKey });
  }

  /**
   * @param {object} job
   * @param {string} userProfile
   */
  async evaluateJob(job, userProfile) {
    const prompt = buildPrompt(job, userProfile);

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.2,
      },
    });

    const text = extractText(response);
    const parsed = parseEvaluationJson(text);
    return {
      score: clampScore(parsed.score),
      matchedSkills: asStringArray(parsed.matchedSkills),
      missingSkills: asStringArray(parsed.missingSkills),
      reason: String(parsed.reason || "").trim() || "No reason provided.",
      raw: parsed,
    };
  }
}

/**
 * Factory for the Gemini strategy provider.
 * @param {{ apiKey?: string, model?: string }} [options]
 */
export function createGeminiProvider(options = {}) {
  return new GeminiProvider(options);
}

/**
 * @param {object} job
 * @param {string} userProfile
 */
function buildPrompt(job, userProfile) {
  const skills = Array.isArray(job?.skills) ? job.skills.join(", ") : "";

  return `Candidate profile:
${String(userProfile || "").trim()}

Job posting:
Title: ${job?.title || ""}
Company: ${job?.company || ""}
Location: ${job?.location || ""}
Skills: ${skills || "Not listed"}
Description:
${String(job?.description || "").slice(0, 6000)}

Evaluate fit and respond with JSON fields score, matchedSkills, missingSkills, reason.`;
}

/**
 * @param {unknown} response
 */
function extractText(response) {
  if (!response) return "";
  if (typeof response.text === "string") return response.text;
  if (typeof response.text === "function") {
    try {
      return response.text();
    } catch {
      // fall through
    }
  }

  const parts = response?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    return parts
      .map((part) => part?.text || "")
      .join("")
      .trim();
  }

  return "";
}

/**
 * @param {string} text
 */
function parseEvaluationJson(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    throw new Error("Gemini returned an empty response");
  }

  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw new Error("Gemini returned invalid JSON");
  }
}

/**
 * @param {unknown} value
 */
function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}
